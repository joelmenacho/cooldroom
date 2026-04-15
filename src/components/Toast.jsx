export default function Toast({ text }) {
  if (!text) return null;
  return <div className="toast">{text}</div>;
}
