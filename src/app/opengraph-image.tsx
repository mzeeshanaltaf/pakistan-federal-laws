import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          backgroundColor: "#FAF7F1",
          color: "#20223A",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: "#3B4080" }}>Qanoon &middot; قانون</div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 64, fontWeight: 600, lineHeight: 1.1 }}>
          Every federal law of Pakistan,
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 600, lineHeight: 1.1 }}>answerable.</div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 28, color: "#5B5E76", maxWidth: 820 }}>
          Plain-language answers grounded in statute text, with citations to the exact page.
        </div>
      </div>
    ),
    { ...size }
  );
}
