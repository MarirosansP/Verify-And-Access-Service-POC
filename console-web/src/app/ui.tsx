export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#1B2735",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: 20,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, letterSpacing: "-0.2px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function Button({ children, variant = "primary", ...props }: any) {
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: "#28C76F", color: "#fff",     border: "none" },
    secondary: { background: "transparent", color: "#9FB2D3", border: "1px solid rgba(255,255,255,0.15)" },
    danger:    { background: "transparent", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" },
    info:      { background: "#0891b2",     color: "#fff",     border: "none" },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button
      {...props}
      style={{
        ...v,
        padding: "9px 16px",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 13,
        fontFamily: "inherit",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

export function Input(props: any) {
  const { style: propStyle, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: "100%",
        padding: "9px 12px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#0D1825",
        color: "#e7edf7",
        fontSize: 14,
        fontFamily: "inherit",
        boxSizing: "border-box",
        outline: "none",
        ...(propStyle || {}),
      }}
    />
  );
}

export function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: "#9FB2D3" }}>{children}</div>;
}
