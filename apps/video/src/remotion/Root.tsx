import React from "react";
import { Composition } from "remotion";
import { AiVerseIntro, totalDurationInFrames } from "./AiVerse/AiVerseIntro";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AiVerseIntro"
        component={AiVerseIntro}
        durationInFrames={totalDurationInFrames}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
