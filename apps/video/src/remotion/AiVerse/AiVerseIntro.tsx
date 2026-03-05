import React from "react";
import {
  AbsoluteFill,
  Audio as _Audio,
  Img,
  OffthreadVideo,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Easing,
} from "remotion";
const Audio = _Audio as unknown as React.FC<{
  src: string;
  volume?: number;
  loop?: boolean;
  startFrom?: number;
  endAt?: number;
}>;
import { loadFont, fontFamily } from "@remotion/google-fonts/Inter";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("react-qr-code").default as React.FC<{
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}>;

loadFont("normal", {
  weights: ["400", "500", "700", "800"],
});

const FPS = 30;
const FADE_DURATION = 15;

// ============================================
// CONFIG
// ============================================

const CONFIG = {
  productName: "AiVerse",
  tagline: "Создай что угодно\nс помощью AI",
  features: [
    {
      title: "AI Генерация",
      description:
        "SeeDream, Kling AI, GPT Image — лучшие модели в одном приложении",
      badge: "",
    },
    {
      title: "AI Видео",
      description:
        "Text-to-Video и Image-to-Video через Kling AI и Seedance Pro",
      image: "feature-2.png",
      badge: "Video AI",
    },
    {
      title: "Лента работ",
      description:
        "Смотри работы сообщества, ставь лайки и создавай ремиксы",
      image: "feature-3.png",
      video: "record-2.MP4",
      badge: "100K+ работ",
    },
  ],
  cta: "Попробуй бесплатно",
  url: "aiverseapp.net",
  mockupVideo: "record-1.MP4",
  accent: "#a855f7",
  accentBg: "rgba(168, 85, 247, 0.12)",
};

const AI_MODELS = [
  { name: "GPT Image", icon: "models/gpt-image.png" },
  { name: "NanoBanana Pro", icon: "models/nanobanana-pro.png" },
  { name: "Seedream 4.5", icon: "models/seedream-4-5.png" },
  { name: "Qwen", icon: "models/qwen.png" },
  { name: "NanoBanana 2", icon: "models/nanobanana-2.jpg" },
  { name: "Kling AI", icon: "models/kling.png" },
  { name: "Seedance", icon: "models/seedance.png" },
];

// ============================================
// SCENE TIMING (frames)
// ============================================

const SCENES = [
  { id: "reveal", duration: Math.round(2.5 * FPS) },
  { id: "concept", duration: Math.round(5 * FPS) },
  { id: "mockups", duration: Math.round(3.5 * FPS) },
  { id: "feature0", duration: Math.round(4 * FPS) },
  { id: "feature1", duration: Math.round(3.5 * FPS) },
  { id: "feature2", duration: Math.round(3.5 * FPS) },
  { id: "outro", duration: Math.round(3 * FPS) },
  { id: "cta", duration: Math.round(3.5 * FPS) },
];

const sceneStarts: number[] = [];
let offset = 0;
for (const s of SCENES) {
  sceneStarts.push(offset);
  offset += s.duration;
}

export const totalDurationInFrames = offset;

// ============================================
// SHARED COMPONENTS
// ============================================

const SceneFade: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
}> = ({ children, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, FADE_DURATION], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - FADE_DURATION, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>
      {children}
    </AbsoluteFill>
  );
};

const PhoneMockup: React.FC<{
  children: React.ReactNode;
  scale?: number;
}> = ({ children, scale = 1 }) => (
  <div
    style={{
      transform: `scale(${scale})`,
      transformOrigin: "top center",
      position: "relative",
      width: 620,
      height: 1300,
      borderRadius: 64,
      backgroundColor: "#111",
      padding: 12,
      boxShadow:
        "0 0 0 2px rgba(255,255,255,0.06), 0 80px 160px rgba(0,0,0,0.5), 0 0 100px rgba(168,85,247,0.15)",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 22,
        left: "50%",
        transform: "translateX(-50%)",
        width: 160,
        height: 38,
        backgroundColor: "#000",
        borderRadius: 24,
        zIndex: 10,
      }}
    />
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 52,
        overflow: "hidden",
        backgroundColor: "#0a0a0a",
      }}
    >
      {children}
    </div>
  </div>
);

const FadeUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}> = ({ children, delay = 0, duration = 18 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const translateY = interpolate(frame - delay, [0, duration], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  return (
    <div style={{ opacity, transform: `translateY(${translateY}px)` }}>
      {children}
    </div>
  );
};

const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const scale = interpolate(progress, [0, 1], [0.85, 1]);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ opacity, transform: `scale(${scale})` }}>{children}</div>
  );
};

const TypewriterText: React.FC<{
  text: string;
  startFrame?: number;
  speed?: number;
  style?: React.CSSProperties;
}> = ({ text, startFrame = 0, speed = 2, style }) => {
  const frame = useCurrentFrame();
  const charsVisible = Math.floor((frame - startFrame) * speed);
  const displayed = text.slice(0, Math.max(0, charsVisible));
  return (
    <span style={style}>
      {displayed}
      <span
        style={{
          opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0,
          marginLeft: 2,
        }}
      >
        |
      </span>
    </span>
  );
};

/** Floating particles background */
const Particles: React.FC<{ count?: number; color?: string }> = ({
  count = 20,
  color = "168,85,247",
}) => {
  const frame = useCurrentFrame();
  // Deterministic "random" positions using index
  const particles = Array.from({ length: count }, (_, i) => {
    const x = ((i * 137.5) % 100); // golden angle spread
    const y = ((i * 73.13) % 100);
    const size = 3 + (i % 4) * 2;
    const speed = 0.3 + (i % 5) * 0.15;
    const phase = i * 0.7;
    return { x, y, size, speed, phase };
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const floatX = Math.sin((frame * p.speed * 0.02) + p.phase) * 30;
        const floatY = Math.cos((frame * p.speed * 0.015) + p.phase) * 40;
        const particleOpacity = interpolate(
          Math.sin((frame * 0.03) + p.phase),
          [-1, 1],
          [0.1, 0.5]
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: `rgba(${color},${particleOpacity})`,
              boxShadow: `0 0 ${p.size * 3}px rgba(${color},${particleOpacity * 0.5})`,
              transform: `translate(${floatX}px, ${floatY}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Animated counter: counts from 0 up to target number */
const AnimatedCounter: React.FC<{
  value: string;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ value, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  // Extract numeric part and suffix (e.g. "10K+" -> 10, "K+")
  const match = value.match(/^(\d+)(.*)/);
  if (!match) return <span style={style}>{value}</span>;

  const targetNum = parseInt(match[1], 10);
  const suffix = match[2];

  const progress = interpolate(localFrame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const currentNum = Math.round(targetNum * progress);

  return (
    <span style={style}>
      {currentNum}
      {suffix}
    </span>
  );
};

/** Animated loading dots */
const LoadingDots: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  if (localFrame < 0) return null;

  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        display: "flex",
        gap: 12,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 24,
      }}
    >
      {[0, 1, 2].map((i) => {
        const dotOpacity = interpolate(
          Math.sin((localFrame + i * 8) / 6),
          [-1, 1],
          [0.2, 1]
        );
        return (
          <div
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: CONFIG.accent,
              opacity: dotOpacity,
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================
// SCENE 1: REVEAL (logo instead of purple A)
// ============================================

const RevealScene: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
    delay: 5,
  });
  const scale = interpolate(progress, [0, 1], [0.75, 1]);
  const opacity = interpolate(progress, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const glowOpacity = interpolate(
    frame,
    [10, 40, 60, 75],
    [0, 0.6, 0.3, 0.4],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <Particles count={120} />
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 600px 400px at 50% 50%, rgba(168,85,247,${glowOpacity * 0.3}) 0%, transparent 70%)`,
          }}
        />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              opacity,
              transform: `scale(${scale})`,
              width: 240,
              height: 240,
              borderRadius: 56,
              overflow: "hidden",
              boxShadow: "0 0 100px rgba(168,85,247,0.5)",
              marginBottom: 12,
            }}
          >
            <Img
              src={staticFile("logo.png")}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 110,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: -4,
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            {CONFIG.productName}
          </div>
          <FadeUp delay={20} duration={15}>
            <div
              style={{
                fontFamily,
                fontSize: 26,
                fontWeight: 400,
                color: "rgba(255,255,255,0.45)",
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              AI Creative Platform
            </div>
          </FadeUp>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 2: CONCEPT (typewriter + loading + generated image)
// ============================================

const ConceptScene: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const PROMPT_TEXT =
    "На этой фотографии запечатлена девушка в элегантном и сдержанном образе, сделавшая селфи во время отдыха в заведении....";

  const cardProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
    delay: 5,
  });
  const cardY = interpolate(cardProgress, [0, 1], [40, 0]);
  const cardOpacity = interpolate(cardProgress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Typewriter finishes around frame 65
  const typewriterDone = 65;

  // Loading starts after typewriter
  const loadingStart = typewriterDone + 5;

  // Generated image appears
  const imageStart = loadingStart + 25;
  const imageOpacity = interpolate(
    frame,
    [imageStart, imageStart + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const imageScale = interpolate(
    frame,
    [imageStart, imageStart + 25],
    [0.9, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    }
  );
  // Image blur resolves from blurry to sharp
  const imageBlur = interpolate(
    frame,
    [imageStart, imageStart + 30],
    [20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Hide loading dots once image appears
  const loadingOpacity = interpolate(
    frame,
    [imageStart - 5, imageStart + 5],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {/* Tagline */}
          <FadeUp delay={0} duration={20}>
            <div
              style={{
                fontFamily,
                fontSize: 72,
                fontWeight: 800,
                color: "#fff",
                textAlign: "center",
                lineHeight: 1.15,
                letterSpacing: -2,
              }}
            >
              {CONFIG.tagline.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </FadeUp>

          {/* Prompt card */}
          <div
            style={{
              opacity: cardOpacity,
              transform: `translateY(${cardY}px)`,
              width: 880,
              borderRadius: 24,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "32px 40px",
            }}
          >
            <div
              style={{
                fontFamily,
                fontSize: 16,
                fontWeight: 500,
                color: CONFIG.accent,
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              Промпт
            </div>
            <TypewriterText
              text={PROMPT_TEXT}
              startFrame={15}
              speed={3}
              style={{
                fontFamily,
                fontSize: 26,
                fontWeight: 400,
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.5,
              }}
            />
            {/* Loading dots */}
            <div style={{ opacity: loadingOpacity }}>
              <LoadingDots startFrame={loadingStart} />
            </div>
          </div>

          {/* Generated image — gen1.jpeg */}
          <div
            style={{
              opacity: imageOpacity,
              transform: `scale(${imageScale})`,
              filter: `blur(${imageBlur}px)`,
              width: 880,
              height: 550,
              borderRadius: 20,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: `0 0 60px rgba(168,85,247,${imageOpacity * 0.3})`,
            }}
          >
            <Img
              src={staticFile("gen1.jpeg")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 3: MOCKUPS (video instead of screenshot)
// ============================================

const MockupsScene: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 70 },
    delay: 5,
  });
  const phoneY = interpolate(phoneProgress, [0, 1], [60, 0]);
  const phoneOpacity = interpolate(phoneProgress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const floatY = Math.sin(frame / 22) * 6;

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 500px 500px at 50% 60%, rgba(168,85,247,0.08) 0%, transparent 70%)",
          }}
        />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 120,
            paddingTop: 120,
          }}
        >
          <FadeUp delay={0}>
            <div
              style={{
                fontFamily,
                fontSize: 46,
                fontWeight: 500,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: 5,
              }}
            >
              Telegram Mini App · Web App
            </div>
          </FadeUp>
          <div
            style={{
              opacity: phoneOpacity,
              transform: `translateY(${phoneY + floatY}px)`,
            }}
          >
            <PhoneMockup scale={1.05}>
              <OffthreadVideo
                src={staticFile(CONFIG.mockupVideo)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </PhoneMockup>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 4: MODEL ICONS (Feature 1 - AI Generation)
// ============================================

const ModelIconsScene: React.FC<{
  title: string;
  description: string;
  badge: string;
  dur: number;
}> = ({ title, description, badge, dur }) => {
  const frame = useCurrentFrame();

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 56,
            padding: "60px 60px",
          }}
        >
          {/* Model icons grid */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 28,
            }}
          >
            {[AI_MODELS.slice(0, 4), AI_MODELS.slice(4)].map(
              (row, rowIdx) => (
                <div key={rowIdx} style={{ display: "flex", gap: 32 }}>
                  {row.map((model, i) => {
                    const globalIdx = rowIdx === 0 ? i : i + 4;
                    const delay = globalIdx * 6;
                    const modelOpacity = interpolate(
                      frame - delay,
                      [0, 15],
                      [0, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }
                    );
                    const modelScale = interpolate(
                      frame - delay,
                      [0, 15],
                      [0.5, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.out(Easing.back(1.5)),
                      }
                    );
                    return (
                      <div
                        key={model.name}
                        style={{
                          opacity: modelOpacity,
                          transform: `scale(${modelScale})`,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: 32,
                            overflow: "hidden",
                            backgroundColor: "rgba(255,255,255,0.06)",
                            border: "2px solid rgba(255,255,255,0.1)",
                            boxShadow: `0 0 30px rgba(168,85,247,${modelOpacity * 0.2})`,
                          }}
                        >
                          <Img
                            src={staticFile(model.icon)}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontFamily,
                            fontSize: 20,
                            fontWeight: 600,
                            color: "rgba(255,255,255,0.7)",
                            textAlign: "center",
                            maxWidth: 120,
                          }}
                        >
                          {model.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Text below icons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              maxWidth: 960,
            }}
          >
            {badge ? (
              <FadeUp delay={40}>
                <div
                  style={{
                    fontFamily,
                    fontSize: 28,
                    fontWeight: 600,
                    color: CONFIG.accent,
                    backgroundColor: CONFIG.accentBg,
                    padding: "12px 28px",
                    borderRadius: 28,
                    letterSpacing: 0.5,
                  }}
                >
                  {badge}
                </div>
              </FadeUp>
            ) : null}
            <FadeUp delay={badge ? 48 : 40}>
              <div
                style={{
                  fontFamily,
                  fontSize: 72,
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.1,
                  letterSpacing: -1,
                  textAlign: "center",
                }}
              >
                {title}
              </div>
            </FadeUp>
            <FadeUp delay={56}>
              <div
                style={{
                  fontFamily,
                  fontSize: 34,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.4,
                  textAlign: "center",
                  padding: "0 40px",
                }}
              >
                {description}
              </div>
            </FadeUp>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 5: VIDEO FEATURE (Feature 2 - AI Video)
// ============================================

const VideoFeatureScene: React.FC<{
  title: string;
  description: string;
  video: string;
  badge: string;
  dur: number;
}> = ({ title, description, video, badge, dur }) => {
  const frame = useCurrentFrame();
  const floatY = Math.sin(frame / 20) * 5;

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 36,
            paddingTop: 80,
          }}
        >
          <ScaleIn delay={5}>
            <div style={{ transform: `translateY(${floatY}px)` }}>
              <PhoneMockup scale={1}>
                <OffthreadVideo
                  src={staticFile(video)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </PhoneMockup>
            </div>
          </ScaleIn>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              maxWidth: 960,
            }}
          >
            <FadeUp delay={8}>
              <div
                style={{
                  fontFamily,
                  fontSize: 28,
                  fontWeight: 600,
                  color: CONFIG.accent,
                  backgroundColor: CONFIG.accentBg,
                  padding: "12px 28px",
                  borderRadius: 28,
                  letterSpacing: 0.5,
                }}
              >
                {badge}
              </div>
            </FadeUp>
            <FadeUp delay={16}>
              <div
                style={{
                  fontFamily,
                  fontSize: 72,
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.1,
                  letterSpacing: -1,
                  textAlign: "center",
                }}
              >
                {title}
              </div>
            </FadeUp>
            <FadeUp delay={26}>
              <div
                style={{
                  fontFamily,
                  fontSize: 34,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.4,
                  textAlign: "center",
                  padding: "0 40px",
                }}
              >
                {description}
              </div>
            </FadeUp>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 6: IMAGE FEATURE (Feature 3 - Feed)
// ============================================

const ImageFeatureScene: React.FC<{
  title: string;
  description: string;
  image: string;
  badge: string;
  dur: number;
}> = ({ title, description, image, badge, dur }) => {
  const frame = useCurrentFrame();
  const floatY = Math.sin(frame / 20) * 5;

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 36,
            paddingTop: 80,
          }}
        >
          <ScaleIn delay={5}>
            <div style={{ transform: `translateY(${floatY}px)` }}>
              <PhoneMockup scale={1}>
                <Img
                  src={staticFile(image)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </PhoneMockup>
            </div>
          </ScaleIn>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              maxWidth: 960,
            }}
          >
            <FadeUp delay={8}>
              <div
                style={{
                  fontFamily,
                  fontSize: 28,
                  fontWeight: 600,
                  color: CONFIG.accent,
                  backgroundColor: CONFIG.accentBg,
                  padding: "12px 28px",
                  borderRadius: 28,
                  letterSpacing: 0.5,
                }}
              >
                {badge}
              </div>
            </FadeUp>
            <FadeUp delay={16}>
              <div
                style={{
                  fontFamily,
                  fontSize: 72,
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.1,
                  letterSpacing: -1,
                  textAlign: "center",
                }}
              >
                {title}
              </div>
            </FadeUp>
            <FadeUp delay={26}>
              <div
                style={{
                  fontFamily,
                  fontSize: 34,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.4,
                  textAlign: "center",
                  padding: "0 40px",
                }}
              >
                {description}
              </div>
            </FadeUp>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 7: STATS / OUTRO
// ============================================

const OutroScene: React.FC<{ dur: number }> = ({ dur }) => {
  const stats = [
    { value: "10K+", label: "пользователей" },
    { value: "100K+", label: "работ создано" },
    { value: "10+", label: "AI моделей" },
  ];

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 48,
          }}
        >
          <ScaleIn delay={0}>
            <div
              style={{
                fontFamily,
                fontSize: 88,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: -3,
              }}
            >
              {CONFIG.productName}
            </div>
          </ScaleIn>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 56,
            }}
          >
            {stats.map((stat, i) => (
              <FadeUp key={i} delay={10 + i * 10}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <AnimatedCounter
                    value={stat.value}
                    delay={10 + i * 10}
                    style={{
                      fontFamily,
                      fontSize: 56,
                      fontWeight: 800,
                      color: CONFIG.accent,
                      letterSpacing: -1,
                    }}
                  />
                  <div
                    style={{
                      fontFamily,
                      fontSize: 22,
                      fontWeight: 400,
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 8: CTA
// ============================================

const CTAScene: React.FC<{ dur: number }> = ({ dur }) => {

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <Particles count={120} />
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 600px 400px at 50% 60%, rgba(168,85,247,0.15) 0%, transparent 70%)",
          }}
        />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <FadeUp delay={0} duration={15}>
            <div
              style={{
                fontFamily,
                fontSize: 72,
                fontWeight: 800,
                color: "#fff",
                textAlign: "center",
                letterSpacing: -1,
              }}
            >
              {CONFIG.cta}
            </div>
          </FadeUp>

          {/* QR codes row — aligned side by side */}
          <ScaleIn delay={10}>
            <div
              style={{
                display: "flex",
                gap: 48,
                alignItems: "flex-start",
              }}
            >
              {/* Website QR */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    padding: 20,
                    backgroundColor: "#fff",
                    borderRadius: 28,
                    boxShadow:
                      "0 0 60px rgba(168,85,247,0.25), 0 0 120px rgba(168,85,247,0.1)",
                  }}
                >
                  <QRCode
                    value={`https://${CONFIG.url}`}
                    size={260}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                  />
                </div>
                <div
                  style={{
                    fontFamily,
                    fontSize: 34,
                    fontWeight: 700,
                    color: "#fff",
                    textAlign: "center",
                  }}
                >
                  🌐 Web App
                </div>
                <div
                  style={{
                    fontFamily,
                    fontSize: 24,
                    fontWeight: 500,
                    color: "rgba(168,85,247,0.8)",
                    textAlign: "center",
                  }}
                >
                  {CONFIG.url}
                </div>
              </div>

              {/* Telegram Bot QR */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    padding: 20,
                    backgroundColor: "#fff",
                    borderRadius: 28,
                    boxShadow:
                      "0 0 60px rgba(39,160,228,0.25), 0 0 120px rgba(39,160,228,0.1)",
                  }}
                >
                  <QRCode
                    value="https://t.me/aiverse_hub_bot"
                    size={260}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                  />
                </div>
                <div
                  style={{
                    fontFamily,
                    fontSize: 34,
                    fontWeight: 700,
                    color: "#fff",
                    textAlign: "center",
                  }}
                >
                  ✈️ Telegram Bot
                </div>
                <div
                  style={{
                    fontFamily,
                    fontSize: 24,
                    fontWeight: 500,
                    color: "rgba(39,160,228,0.8)",
                    textAlign: "center",
                  }}
                >
                  @aiverse_hub_bot
                </div>
              </div>
            </div>
          </ScaleIn>

          <FadeUp delay={28}>
            <div
              style={{
                fontFamily,
                fontSize: 30,
                fontWeight: 500,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Telegram Mini App · Web App
            </div>
          </FadeUp>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const AiVerseIntro: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* 1. Reveal */}
      <Sequence from={sceneStarts[0]} durationInFrames={SCENES[0].duration}>
        <RevealScene dur={SCENES[0].duration} />
      </Sequence>

      {/* 2. Concept (typewriter + loading + generation) */}
      <Sequence from={sceneStarts[1]} durationInFrames={SCENES[1].duration}>
        <ConceptScene dur={SCENES[1].duration} />
      </Sequence>

      {/* 3. Mockups (video) */}
      <Sequence from={sceneStarts[2]} durationInFrames={SCENES[2].duration}>
        <MockupsScene dur={SCENES[2].duration} />
      </Sequence>

      {/* 4. Feature 1 - AI Generation (model icons) */}
      <Sequence from={sceneStarts[3]} durationInFrames={SCENES[3].duration}>
        <ModelIconsScene
          title={CONFIG.features[0].title}
          description={CONFIG.features[0].description}
          badge={CONFIG.features[0].badge}
          dur={SCENES[3].duration}
        />
      </Sequence>

      {/* 5. Feature 2 - AI Video (image in device) */}
      <Sequence from={sceneStarts[4]} durationInFrames={SCENES[4].duration}>
        <ImageFeatureScene
          title={CONFIG.features[1].title}
          description={CONFIG.features[1].description}
          image={CONFIG.features[1].image!}
          badge={CONFIG.features[1].badge}
          dur={SCENES[4].duration}
        />
      </Sequence>

      {/* 6. Feature 3 - Feed (video in device) */}
      <Sequence from={sceneStarts[5]} durationInFrames={SCENES[5].duration}>
        <VideoFeatureScene
          title={CONFIG.features[2].title}
          description={CONFIG.features[2].description}
          video={CONFIG.features[2].video!}
          badge={CONFIG.features[2].badge}
          dur={SCENES[5].duration}
        />
      </Sequence>

      {/* 7. Outro / Stats */}
      <Sequence from={sceneStarts[6]} durationInFrames={SCENES[6].duration}>
        <OutroScene dur={SCENES[6].duration} />
      </Sequence>

      {/* 8. CTA */}
      <Sequence from={sceneStarts[7]} durationInFrames={SCENES[7].duration}>
        <CTAScene dur={SCENES[7].duration} />
      </Sequence>

      {/* ===== AUDIO / SFX ===== */}

      {/* Ambient background loop — full duration, low volume */}
      <Audio
        src={staticFile("sfx/ambient-loop.mp3")}
        volume={0.15}
        loop
      />

      {/* Scene 1: Reveal — shine + whoosh */}
      <Sequence from={sceneStarts[0]} durationInFrames={SCENES[0].duration}>
        <Audio src={staticFile("sfx/shine.mp3")} volume={0.5} />
      </Sequence>

      {/* Scene 2: Concept — typing then magic ding */}
      <Sequence from={sceneStarts[1]} durationInFrames={SCENES[1].duration}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.35} />
      </Sequence>
      <Sequence
        from={sceneStarts[1] + Math.round(3.5 * FPS)}
        durationInFrames={Math.round(1.5 * FPS)}
      >
        <Audio src={staticFile("sfx/magic-ding.mp3")} volume={0.5} />
      </Sequence>

      {/* Scene 3: Mockups — whoosh */}
      <Sequence from={sceneStarts[2]} durationInFrames={SCENES[2].duration}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.4} />
      </Sequence>

      {/* Scene 4: Model Icons — pop sounds staggered */}
      {AI_MODELS.map((_, i) => (
        <Sequence
          key={`pop-${i}`}
          from={sceneStarts[3] + Math.round(0.4 * FPS) + i * 4}
          durationInFrames={Math.round(0.5 * FPS)}
        >
          <Audio src={staticFile("sfx/pop.mp3")} volume={0.3} />
        </Sequence>
      ))}

      {/* Scene 5: AI Video — whoosh */}
      <Sequence from={sceneStarts[4]} durationInFrames={SCENES[4].duration}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.4} />
      </Sequence>

      {/* Scene 6: Feed — whoosh */}
      <Sequence from={sceneStarts[5]} durationInFrames={SCENES[5].duration}>
        <Audio src={staticFile("sfx/whoosh.mp3")} volume={0.4} />
      </Sequence>

      {/* Scene 7: Outro — counter tick */}
      <Sequence from={sceneStarts[6]} durationInFrames={SCENES[6].duration}>
        <Audio src={staticFile("sfx/counter.mp3")} volume={0.35} />
      </Sequence>

      {/* Scene 8: CTA — shine reveal */}
      <Sequence from={sceneStarts[7]} durationInFrames={SCENES[7].duration}>
        <Audio src={staticFile("sfx/shine.mp3")} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};
