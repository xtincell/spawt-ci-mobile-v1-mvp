import type { Ref } from "react";
import type { HostMessage } from "./bridge";
export interface FrameHandle { send: (message: HostMessage) => void; }
export interface FrameProps {
  ref: Ref<FrameHandle>;
  html: string;
  onAction: (raw: unknown) => void;
}
