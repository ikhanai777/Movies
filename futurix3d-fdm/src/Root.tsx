import React from "react";
import { Composition, Still } from "remotion";
import "./fonts";
import { Reel } from "./Reel";
import { Cover } from "./Cover";
import { DURATION_S, FPS, H, W } from "./theme";

export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={Reel} durationInFrames={DURATION_S * FPS} fps={FPS} width={W} height={H} />
    <Still id="Cover" component={Cover} width={W} height={H} />
  </>
);
