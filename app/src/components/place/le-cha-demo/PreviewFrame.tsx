import { useTheme } from "../../../theme/ThemeProvider";
import { useImperativeHandle, useMemo, useRef } from "react";
import { WebView } from "react-native-webview";
import type { FrameProps } from "./types";

const localOrigin = "https://le-cha.spawt.invalid/";
export function PreviewFrame({ ref, html, onAction }: FrameProps) {
  const {colors} = useTheme();
  const view = useRef<WebView>(null);
  const source = useMemo(() => ({html, baseUrl:localOrigin}), [html]);
  useImperativeHandle(ref, () => ({
    send(message) {
      view.current?.injectJavaScript("window.spawtPreviewReceive?.(" + JSON.stringify(message) + "); true;");
    },
  }), []);
  return <WebView ref={view} testID="le-cha-approved-preview" source={source} originWhitelist={["*"]}
    style={{flex:1,backgroundColor:colors.surface.editorial}} javaScriptEnabled domStorageEnabled
    allowFileAccess={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never"
    setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false}
    sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} geolocationEnabled={false}
    onShouldStartLoadWithRequest={({url}) => url === localOrigin || url.startsWith(localOrigin + "#") || url === "about:blank"}
    onMessage={event => onAction(event.nativeEvent.data)} />;
}
