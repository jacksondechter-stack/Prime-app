export default function PrivacyPolicy() {
  return (
    <div style={{
      backgroundColor: '#000000',
      minHeight: '100vh',
      padding: '40px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#ffffff',
      maxWidth: '680px',
      margin: '0 auto',
    }}>

      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '36px', height: '36px', backgroundColor: '#1a1a1a',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ color: '#D62B2B', fontSize: '18px', fontWeight: 'bold' }}>✦</span>
          </div>
          <span style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '2px' }}>
            CALIBR<span style={{ color: '#D62B2B' }}>8</span>
          </span>
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: '800', margin: '0 0 4px 0', lineHeight: 1.1 }}>
          Privacy
        </h1>
        <h1 style={{ fontSize: '36px', fontWeight: '800', margin: '0 0 12px 0', color: '#D62B2B', lineHeight: 1.1 }}>
          Policy.
        </h1>
        <p style={{ color: '#888888', fontSize: '13px', margin: 0 }}>
          Effective Date: February 2026
        </p>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #222222', marginBottom: '32px' }} />

      {sections.map((section, i) => (
        <div key={i} style={{ marginBottom: '28px' }}>
          <h2 style={{
            fontSize: '14px', fontWeight: '700', color: '#ffffff',
            margin: '0 0 8px 0', letterSpacing: '0.3px'
          }}>
            {section.heading}
          </h2>
          <p style={{
            fontSize: '14px', color: '#999999', lineHeight: '1.7', margin: 0
          }}>
            {section.body}
          </p>
          <hr style={{ border: 'none', borderTop: '1px solid #1a1a1a', marginTop: '28px' }} />
        </div>
      ))}

      <p style={{ color: '#555555', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
        © 2026 Calibr8. All rights reserved.
      </p>
    </div>
  );
}

const sections = [
  {
    heading: "1. Introduction",
    body: `Calibr8 ("we," "us," "our") operates the Calibr8 mobile application and website (collectively, the "Service"). This Privacy Policy describes how we collect, use, store, and protect your personal information when you use our Service. By creating an account or using Calibr8, you consent to the practices described in this policy.`
  },
  {
    heading: "2.1  Account Information",
    body: "When you create an account, we collect your username, first and last name, and a securely hashed password. We do not store passwords in plain text."
  },
  {
    heading: "2.2  Body Metrics",
    body: "You may provide height, weight, age, biological sex, body fat percentage, goal weight, training frequency, and alcohol consumption data. This information is used exclusively to generate your personalized fitness plan."
  },
  {
    heading: "2.3  Daily Logs",
    body: "Food intake, workout data, drink logs, body weight entries, and daily summary grades are stored to provide you with progress tracking and historical analytics."
  },
  {
    heading: "2.4  Body Photos",
    body: "If you choose to use our AI body composition feature, photos you submit are transmitted securely to a third-party AI provider (Anthropic) for real-time analysis. Photos are processed transiently and are not permanently stored on our servers or by our AI provider. We do not retain, cache, or use your body photos for any purpose beyond generating your body fat estimate. Photos are never sold, shared, or used for marketing."
  },
  {
    heading: "3. How We Use Your Data",
    body: "Your data is used exclusively to: (a) calculate personalized calorie, protein, and macro targets; (b) generate AI-powered workout programming; (c) provide daily behavioral feedback and grading; (d) project your fitness timeline; and (e) improve your experience within the app. We do not sell, rent, or share your personal information with third parties for marketing or advertising purposes."
  },
  {
    heading: "4. Third-Party Services",
    body: "We use the following third-party services to operate Calibr8: Turso (SQLite cloud database) for secure data storage; Anthropic Claude AI for body composition estimation, workout generation, nutrition analysis, and daily grading; and Vercel for application hosting. Each provider operates under its own privacy policy and data protection standards. Data transmitted to AI services is used solely for generating responses and is not used to train AI models."
  },
  {
    heading: "5. Data Storage and Security",
    body: "Your data is stored on Turso's cloud infrastructure with industry-standard encryption in transit (TLS/SSL) and at rest. Access to user data is restricted to authenticated sessions only. While we implement reasonable security measures, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security."
  },
  {
    heading: "6. Data Retention and Deletion",
    body: "Your data is retained for as long as your account is active. You may request complete deletion of your account and all associated data at any time by contacting calibr8app@gmail.com. Upon receiving a verified deletion request, we will permanently remove your data within 30 days. Deletion is irreversible."
  },
  {
    heading: "7. Your Rights",
    body: "Depending on your jurisdiction, you may have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your data; object to or restrict certain processing; and request portability of your data. To exercise any of these rights, contact calibr8app@gmail.com."
  },
  {
    heading: "8. Children's Privacy",
    body: "Calibr8 is not intended for individuals under the age of 16. We do not knowingly collect personal information from children. If we become aware that a user is under 16, we will promptly delete their account and associated data."
  },
  {
    heading: "9. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. Material changes will be communicated through the app or via notification. Continued use of the Service after changes constitutes acceptance of the updated policy."
  },
  {
    heading: "10. Contact",
    body: "For questions or concerns about this Privacy Policy or your data, contact us at calibr8app@gmail.com."
  },
];
