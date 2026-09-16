import VoiceTestClient from "./VoiceTestClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Voice Accuracy Test | Watibot",
  description: "Test the accuracy of Watibot's AI voice-to-text transcription engine.",
};

export default function Page() {
  return <VoiceTestClient />;
}
