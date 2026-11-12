"use client"; // Error boundaries must be Client Components

/**
 * Last-resort fallback when the root layout itself fails. It renders its own
 * document without global styles, so it uses inline styles in the app's palette.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
          color: "#263238",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            margin: 16,
            padding: "40px 32px",
            textAlign: "center",
            border: "1px solid #e1ecf7",
            borderRadius: 16,
            background: "linear-gradient(#ffffff, #f1f7fd)",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 8px" }}>LUI couldn&apos;t load</h1>
          <p style={{ fontSize: 14, color: "#607d8b", margin: "0 0 20px" }}>
            Something went wrong while starting the app.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              background: "#1e88e5",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
