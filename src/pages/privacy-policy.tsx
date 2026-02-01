import React from "react";

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    fontFamily: "Arial, Helvetica, sans-serif",
    backgroundColor: "#f5f7fb",
    color: "#1f2937",
    minHeight: "100vh",
  },
  header: {
    backgroundColor: "#0f172a",
    color: "#ffffff",
    padding: "30px 20px",
    textAlign: "center",
  },
  logo: {
    maxHeight: "90px",
    marginBottom: "15px",
  },
  title: {
    margin: 0,
    fontSize: "1.8rem",
  },
  main: {
    maxWidth: "900px",
    margin: "40px auto",
    backgroundColor: "#ffffff",
    padding: "40px",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  h2: {
    color: "#2563eb",
    marginTop: "30px",
  },
  footer: {
    textAlign: "center",
    padding: "20px",
    fontSize: "0.9rem",
    color: "#6b7280",
  },
};


const PrivacyPolicy: React.FC = () => {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <img
          src="/epru_logo.jpeg"
          alt="Eastern Province Referees Society Logo"
          style={styles.logo}
        />
        <h1 style={styles.title}>Privacy Policy</h1>
      </header>

      <main style={styles.main}>
        <p>
          <strong>Last updated:</strong> 1 February 2026
        </p>

        <p>
          The Eastern Province Referees Society App (“we”, “our”, or “the app”) is
          designed exclusively for registered referees and officials within the
          Eastern Province Referees Society. We are committed to protecting your
          privacy and handling your information responsibly.
        </p>

        <h2 style={styles.h2}>1. Target Audience</h2>
        <p>This app is intended for <strong>adult users only</strong>.</p>
        <ul>
          <li>The app is <strong>not designed for children</strong></li>
          <li>Users must be <strong>13 years or older</strong></li>
          <li>We do <strong>not knowingly collect data</strong> from children under 13</li>
        </ul>

        <h2 style={styles.h2}>2. Information We Collect</h2>

        <p><strong>Information you provide:</strong></p>
        <ul>
          <li>Name and surname</li>
          <li>Email address</li>
          <li>Referee or membership identification</li>
          <li>Match assignments, availability, and related records</li>
        </ul>

        <p><strong>Automatically collected information:</strong></p>
        <ul>
          <li>Device type and operating system</li>
          <li>App usage statistics (non-identifiable)</li>
          <li>Error and crash diagnostics</li>
        </ul>

        <h2 style={styles.h2}>3. How We Use Your Information</h2>
        <p>Your information is used strictly to:</p>
        <ul>
          <li>Manage referee appointments and activities</li>
          <li>Communicate official notices and updates</li>
          <li>Support administrative and operational needs</li>
          <li>Improve app reliability and performance</li>
        </ul>

        <p>
          We do <strong>not sell, rent, or trade</strong> your personal information.
        </p>

        <h2 style={styles.h2}>4. Data Sharing</h2>
        <p>We do not share your data with third parties, except:</p>
        <ul>
          <li>When legally required</li>
          <li>With trusted service providers strictly for app functionality</li>
        </ul>

        <h2 style={styles.h2}>5. Data Security</h2>
        <ul>
          <li>Secure HTTPS connections</li>
          <li>User authentication and access controls</li>
          <li>Restricted administrative access</li>
        </ul>

        <h2 style={styles.h2}>6. Data Retention</h2>
        <p>
          Data is retained only while you are an active member of the Society or
          as required by administrative or legal obligations.
        </p>

        <h2 style={styles.h2}>7. Your Rights</h2>
        <ul>
          <li>Access your personal information</li>
          <li>Request corrections</li>
          <li>Request deletion where applicable</li>
          <li>Stop using the app at any time</li>
        </ul>

        <h2 style={styles.h2}>8. Changes to This Policy</h2>
        <p>
          This Privacy Policy may be updated periodically. Any changes will be
          reflected on this page with an updated date.
        </p>

        <h2 style={styles.h2}>9. Contact Us</h2>
        <p>
          <strong>Eastern Province Referees Society</strong><br />
          Email: <strong>info@eprreferees.org</strong>
        </p>
      </main>

      <footer style={styles.footer}>
        © 2026 Eastern Province Referees Society. All rights reserved.
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
