import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactions } from "@/hooks/useTransactions";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { startOfMonth, endOfMonth, isWithinInterval, subMonths, format } from "date-fns";
import { Brain, Send, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Insights() {
  const { data: transactions = [] } = useTransactions();
  const { data: profile } = useProfile();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);

  // Monthly breakdown for chart
  const monthlyData = useMemo(() => {
    const months: { name: string; expenses: number; savings: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthTx = transactions.filter((t) =>
        isWithinInterval(new Date(t.date), { start, end })
      );
      const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const expenses = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      months.push({
        name: format(date, "MMM"),
        expenses,
        savings: income - expenses,
      });
    }
    return months;
  }, [transactions]);

  // Anomalies: categories where spending > 150% of average
  const anomalies = useMemo(() => {
    const now = new Date();
    const currentStart = startOfMonth(now);
    const currentEnd = endOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));

    const getCategoryTotals = (start: Date, end: Date) => {
      const txs = transactions.filter(
        (t) => t.type === "expense" && isWithinInterval(new Date(t.date), { start, end })
      );
      const totals: Record<string, number> = {};
      txs.forEach((t) => {
        const cat = t.category || "Other";
        totals[cat] = (totals[cat] || 0) + Number(t.amount);
      });
      return totals;
    };

    const current = getCategoryTotals(currentStart, currentEnd);
    const previous = getCategoryTotals(prevStart, prevEnd);

    return Object.entries(current)
      .filter(([cat, val]) => {
        const prev = previous[cat] || 0;
        return prev > 0 && val > prev * 1.5;
      })
      .map(([cat, val]) => ({
        category: cat,
        current: val,
        previous: previous[cat] || 0,
        increase: ((val / (previous[cat] || 1)) * 100 - 100).toFixed(0),
      }));
  }, [transactions]);

  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const summary = transactions.slice(0, 100).map((t) => `${t.date}: ${t.type} €${t.amount} - ${t.description} [${t.category || "Other"}]`).join("\n");

      const { data, error } = await supabase.functions.invoke("financial-insights", {
        body: {
          transactions: summary,
          budget: profile?.monthly_budget ?? 2000,
          currency: profile?.currency ?? "EUR",
        },
      });

      if (error) throw error;
      setInsights(data.insights);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate insights");
    }
    setInsightsLoading(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    let assistantSoFar = "";
    try {
      const txSummary = transactions.slice(0, 50).map((t) => `${t.date}: ${t.type} €${t.amount} - ${t.description} [${t.category || "Other"}]`).join("\n");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            context: txSummary,
            budget: profile?.monthly_budget ?? 2000,
          }),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("Failed to start chat");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setChatMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Chat error");
    }
    setChatLoading(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-bold">AI Insights</h1>

        {/* Spending Trends */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Expense Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                  <Line type="monotone" dataKey="expenses" stroke="hsl(0, 84%, 60%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="savings" stroke="hsl(142, 71%, 45%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Anomalies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" /> Spending Anomalies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No unusual spending patterns detected</p>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((a) => (
                    <div key={a.category} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{a.category}</span>
                        <span className="text-sm font-semibold text-destructive">+{a.increase}%</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        €{a.current.toFixed(2)} this month vs €{a.previous.toFixed(2)} last month
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <TrendingUp className="h-5 w-5 text-primary" /> AI Budget Analysis
            </CardTitle>
            <Button onClick={generateInsights} disabled={insightsLoading || transactions.length === 0} className="gap-2">
              {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              Generate Insights
            </Button>
          </CardHeader>
          <CardContent>
            {insights ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{insights}</ReactMarkdown>
              </div>
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                {transactions.length === 0 ? "Add some transactions first to get AI insights" : "Click 'Generate Insights' for AI-powered analysis"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI Chat */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Brain className="h-5 w-5 text-primary" /> Financial Advisor Chat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 h-80 overflow-y-auto rounded-lg border bg-muted/30 p-4">
              {chatMessages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  Ask me anything about your finances — budgeting tips, savings strategies, or spending analysis.
                </p>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && chatMessages[chatMessages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                      <div className="rounded-lg border bg-card px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Ask about your finances..."
                disabled={chatLoading}
              />
              <Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
