export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0f1624",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: 16
    }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export function Button({ children, ...props }: any) {
  return (
    <button
      {...props}
      style={{
        background: "#2d6cdf",
        border: "none",
        color: "white",
        padding: "10px 12px",
        borderRadius: 10,
        cursor: "pointer",
        fontWeight: 700,
        ...(props.style || {})
      }}
    >
      {children}
    </button>
  );
}

export function Input(props: any) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#0b0f17",
        color: "#e7edf7"
      }}
    />
  );
}

export function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, opacity: 0.8 }}>{children}</div>;
}
