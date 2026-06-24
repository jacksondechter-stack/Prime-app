export default function SupportPage() {
  const faqs = [
    { q: "How do I cancel my subscription?", a: "Open the Settings app on your iPhone, tap your Apple ID, then Subscriptions, then Calibr8. Tap Cancel Subscription. Access continues until the end of the billing period." },
    { q: "How do I delete my account?", a: "Inside the Calibr8 app, go to the Settings tab and tap Delete Account. This permanently removes all your data and cannot be undone." },
    { q: "The body scan is not working - what should I do?", a: "Make sure you have granted camera and photo library access to Calibr8 in iPhone Settings > Privacy & Security > Camera. Good lighting and a plain background improve accuracy." },
    { q: "I was charged but do not have Pro access - help?", a: "Go to Settings inside the app and tap Restore Purchases. If the issue persists, email calibr8app@gmail.com with your Apple ID and we will sort it out." },
    { q: "How is body fat percentage calculated?", a: "Calibr8 uses AI-based visual analysis combined with your logged measurements. Results are estimates and are not a substitute for medical assessment." },
  ];
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", padding: "60px 24px", maxWidth: "680px", margin: "0 auto" }}>
      <div style={{ marginBottom: "48px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "700", letterSpacing: "-0.5px", marginBottom: "8px", color: "#ffffff" }}>Calibr8 Support</h1>
        <p style={{ color: "#888", fontSize: "16px", lineHeight: "1.5" }}>Have a question or issue? We are here to help.</p>
      </div>
      <section style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: "600", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: "20px" }}>Contact Us</h2>
        <a href="mailto:calibr8app@gmail.com" style={{ display: "inline-block", padding: "14px 24px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: "10px", color: "#ffffff", textDecoration: "none", fontSize: "15px", fontWeight: "500" }}>calibr8app@gmail.com</a>
        <p style={{ color: "#666", fontSize: "14px", marginTop: "12px" }}>We typically respond within 24-48 hours.</p>
      </section>
      <section>
        <h2 style={{ fontSize: "13px", fontWeight: "600", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", marginBottom: "20px" }}>Frequently Asked Questions</h2>
        {faqs.map(({ q, a }, i) => (
          <div key={i} style={{ padding: "20px", background: "#111", border: "1px solid #1e1e1e", borderRadius: "10px", marginBottom: "12px" }}>
            <p style={{ fontWeight: "600", fontSize: "15px", marginBottom: "8px", color: "#fff" }}>{q}</p>
            <p style={{ fontSize: "14px", color: "#999", lineHeight: "1.6", margin: 0 }}>{a}</p>
          </div>
        ))}
      </section>
      <footer style={{ marginTop: "60px", paddingTop: "24px", borderTop: "1px solid #1e1e1e", color: "#555", fontSize: "13px", display: "flex", gap: "16px" }}>
        <a href="/privacy" style={{ color: "#555", textDecoration: "none" }}>Privacy Policy</a>
        <span>2026 Calibr8. All rights reserved.</span>
      </footer>
    </main>
  );
}
