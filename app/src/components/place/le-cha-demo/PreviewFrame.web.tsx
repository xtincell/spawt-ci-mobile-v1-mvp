import { useTranslation } from "react-i18next";
import { useTheme } from "../../../theme/ThemeProvider";
import { useEffect, useImperativeHandle, useRef } from "react";
import { CHANNEL } from "./bridge";
import type { FrameProps } from "./types";

export function PreviewFrame({ ref, html, onAction }: FrameProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const frame = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onAction); handler.current = onAction;
  useImperativeHandle(ref, () => ({
    send(message) {
      frame.current?.contentWindow?.postMessage({channel:CHANNEL, message}, "*");
    },
  }), []);
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.source && event.source === frame.current?.contentWindow) handler.current(event.data);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);
  return <iframe ref={frame} data-testid="le-cha-approved-preview" title={t("le_cha_preview.frame_title")}
    srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer"
    style={{width:"100%", flex:1, minHeight:0, border:0, background:colors.surface.editorial}} />;
}
