import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.location.href = "/broker_tool.html";
  }, []);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      background: "#f5f5f5",
      color: "#222"
    }}>
      <p>Redirecting to Broker Submission Tool...</p>
    </div>
  );
}
