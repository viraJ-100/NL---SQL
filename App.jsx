import React, { useState, useRef, useEffect } from "react";
import { Send, Database } from "lucide-react";
import ChartPanel from "./ChartPanel";   

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [latestAIResponse, setLatestAIResponse] = useState(null);
  const chatEndRef = useRef(null);
    // state
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("http://127.0.0.1:8000/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: input }),
      });

      const data = await response.json();

      const aiMessage = { 
        sender: "ai", 
        sql: data.sql, 
        intent: data.intent, 
        original_sql: data.original_sql,
        result: data.result,       // chart
        page_result: data.page_result, // table
        chart: data.chart   
      };


      setMessages((prev) => [...prev, aiMessage]);
      setLatestAIResponse(aiMessage);


    } catch (error) {
      console.error("Error:", error);
    }

    setInput("");
  };


  const handlePagination = async (direction) => {
    if (!latestAIResponse) return;

    let newOffset = offset;
    if (direction === "next") newOffset += limit;
    if (direction === "prev" && offset >= limit) newOffset -= limit;

    try {
      const response = await fetch("http://127.0.0.1:8000/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sql: latestAIResponse.original_sql,
          limit,
          offset: newOffset
        }),
      });

      const data = await response.json();

      // update only page_result
      const updated = {
        ...latestAIResponse,
        page_result: data.page_result
      };

      setLatestAIResponse(updated);

      setMessages((prev) =>
        prev.map((msg) =>
          msg === latestAIResponse ? updated : msg
        )
      );

      setOffset(newOffset);
    } catch (err) {
      console.error("Pagination error:", err);
    }
  };


  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex flex-col">
        {/* Header */}
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10 shadow-lg">
          <div className="flex items-center justify-center p-6">
            <Database className="w-8 h-8 text-green-400 mr-3" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent drop-shadow-md">
              NL TO SQL
            </h1>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
        {/* Chat Container */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Database className="w-16 h-16 text-green-400/60 mx-auto mb-4" />
                  <p className="text-gray-300 text-lg">Ask me anything about your database</p>
                  <p className="text-gray-500 text-sm mt-2">I will convert your natural language into SQL queries ✨</p>
                </div>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  } animate-fade-in`}
                >
                  <div
                    className={`chat-bubble ${
                      msg.sender === "user" ? "user-message" : "bot-message"
                    }`}
                  >
                    {msg.sender === "ai" ? (
                    <div className="space-y-3">
                      {/* Intent */}
                      <div className="text-xs text-blue-300">
                        <span className="font-semibold">Intent:</span> {msg.intent}
                      </div>

                      {/* SQL */}
                      <div>
                        <div className="flex items-center mb-2">
                          <Database className="w-4 h-4 text-green-300 mr-2" />
                          <span className="text-sm text-green-300 font-medium">SQL Query</span>
                        </div>
                        <pre className="text-sm font-mono bg-black/30 p-3 rounded-lg overflow-x-auto text-green-200">
                          <code>{msg.sql}</code>
                        </pre>
                      </div>

                      {/* Results Table */}
                      {/* Results Table with Pagination */}
                      {msg.result && Array.isArray(msg.result) && msg.result.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm border border-gray-600">
                            <thead className="bg-gray-800 text-gray-200">
                              <tr>
                                {Object.keys(msg.result[0]).map((col) => (
                                  <th key={col} className="px-3 py-2 border border-gray-600">{col}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const rowsPerPage = msg.rowsPerPage || 10;
                                const currentPage = msg.page || 0;
                                const startIndex = currentPage * rowsPerPage;
                                const paginatedRows = msg.result.slice(startIndex, startIndex + rowsPerPage);

                                return paginatedRows.map((row, i) => (
                                  <tr key={i} className="border-t border-gray-700">
                                    {Object.values(row).map((val, j) => (
                                      <td key={j} className="px-3 py-2 border border-gray-600">{val}</td>
                                    ))}
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>

                          {/* Pagination Controls */}
                          <div className="flex justify-between items-center mt-2">
                            {/* Rows per page selector */}
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-300 text-sm">Rows per page:</span>
                              <select
                                value={msg.rowsPerPage || 10}
                                onChange={(e) => {
                                  const newRows = parseInt(e.target.value, 10);
                                  setMessages(prev =>
                                    prev.map((m, idx) =>
                                      idx === index ? { ...m, rowsPerPage: newRows, page: 0 } : m
                                    )
                                  );
                                  if (index === messages.length - 1) {
                                    setLatestAIResponse(prev => ({
                                      ...prev,
                                      rowsPerPage: newRows,
                                      page: 0
                                    }));
                                  }
                                }}
                                className="bg-gray-800 text-gray-200 border border-gray-600 rounded px-2 py-1 text-sm"
                              >
                                {[5, 10, 20, 50].map((n) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>

                            <button
                              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                              onClick={() => {
                                const newPage = Math.max((msg.page || 0) - 1, 0);

                                setMessages(prev =>
                                  prev.map((m, idx) =>
                                    idx === index ? { ...m, page: newPage } : m
                                  )
                                );

                                if (index === messages.length - 1) {
                                  setLatestAIResponse(prev => ({ ...prev, page: newPage }));
                                }
                              }}

                              disabled={(msg.page || 0) === 0}
                            >
                              Previous
                            </button>

                            <span className="text-gray-300 text-sm">
                              Page {(msg.page || 0) + 1} of{" "}
                              {Math.ceil(msg.result.length / (msg.rowsPerPage || 10))}
                            </span>

                            <button
                              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50"
                              onClick={() => {
                                const totalPages = Math.ceil(msg.result.length / (msg.rowsPerPage || 10));
                                const newPage = Math.min((msg.page || 0) + 1, totalPages - 1);
                                setMessages(prev =>
                                  prev.map((m, idx) =>
                                    idx === index
                                      ? { ...m, page: Math.min((m.page || 0) + 1, totalPages - 1) }
                                      : m
                                  )
                                );
                                if (index === messages.length - 1) {
                                  setLatestAIResponse(prev => ({ ...prev, page: newPage }));
                                }
                              }}
                              disabled={(msg.page || 0) + 1 >= Math.ceil(msg.result.length / (msg.rowsPerPage || 10))}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  )}

                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-white/10 bg-black/40 backdrop-blur-md">
            <div className="flex items-center space-x-4 max-w-3xl mx-auto">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Ask about your database..."
                  className="w-full p-4 pr-12 rounded-2xl bg-white/10 backdrop-blur-md text-white placeholder-gray-400 border border-green-400/30 focus:outline-none focus:ring-2 focus:ring-green-500/60 focus:border-transparent transition-all duration-200"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-xl bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-400 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-200 group shadow-md"
                >
                  <Send className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform duration-200" />
                </button>
              </div>
            </div>
            <div className="text-center mt-3">
              <p className="text-gray-500 text-xs">
                Press Enter to send • Natural language to SQL conversion
              </p>
            </div>
          </div>
        </div>


        {/* Right: Charts */}
        <div className="w-1/2 bg-black/20 backdrop-blur-md p-6 overflow-hidden flex flex-col">
          <h2 className="text-xl font-semibold text-green-300 mb-4">📊 Chart Preview</h2>
          <div className="flex-1 flex items-center justify-center">
            {latestAIResponse && (
            <ChartPanel
              data={{
                ...latestAIResponse,
                result:
                  latestAIResponse?.result?.slice(
                    (latestAIResponse.page || 0) * (latestAIResponse.rowsPerPage || 10),
                    (latestAIResponse.page || 0) * (latestAIResponse.rowsPerPage || 10) +
                      (latestAIResponse.rowsPerPage || 10)
                  ) || [],
                page: latestAIResponse.page || 0,
                rowsPerPage: latestAIResponse.rowsPerPage || 10,
              }}
            />
          )}


          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
