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
const VOICEOVER_INTRO_DURATION_FRAMES = Math.round(0.966531 * FPS);
type Locale = "en" | "ru";
const LOCALE: Locale = "ru";
const VOICEOVER_LANGUAGE: Locale = LOCALE;
const VOICEOVER_INTRO_FILE = "sfx/voiceover-intro-en.mp3"; // shared intro
const VOICEOVER_MAIN_FILE =
  VOICEOVER_LANGUAGE === "en" ? "sfx/voiceover-en.mp3" : "sfx/voiceover-ru.mp3";

type FeatureCopy = {
  title: string;
  description: string;
  badge: string;
  image?: string;
  video?: string;
};

type LocalizedCopy = {
  tagline: string;
  features: FeatureCopy[];
  cta: string;
  promptLabel: string;
  promptText: string;
  stats: { value: string; label: string }[];
};

const LOCALIZED_COPY: Record<Locale, LocalizedCopy> = {
  en: {
    tagline: "Create anything\nwith AI",
    features: [
      {
        title: "AI Generation",
        description: "SeeDream, Kling AI, GPT Image — top models in one app",
        badge: "",
      },
      {
        title: "AI Video",
        description:
          "Text-to-Video and Image-to-Video with Kling AI and Seedance Pro",
        image: "feature-2.png",
        badge: "Video AI",
      },
      {
        title: "Community Feed",
        description: "Browse community creations, like, and remix",
        image: "feature-3.png",
        video: "record-2.MP4",
        badge: "100K+ creations",
      },
    ],
    cta: "Try it for free",
    promptLabel: "Prompt",
    promptText:
      "This photo captures a woman in an elegant, minimal look taking a selfie while relaxing at a cafe....",
    stats: [
      { value: "10K+", label: "users" },
      { value: "100K+", label: "creations made" },
    ],
  },
  ru: {
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
        description: "Смотри работы сообщества, ставь лайки и создавай ремиксы",
        image: "feature-3.png",
        video: "record-2.MP4",
        badge: "100K+ работ",
      },
    ],
    cta: "Попробуй бесплатно",
    promptLabel: "Промпт",
    promptText:
      "На этой фотографии запечатлена девушка в элегантном и сдержанном образе, сделавшая селфи во время отдыха в заведении....",
    stats: [
      { value: "10K+", label: "пользователей" },
      { value: "100K+", label: "работ создано" },
    ],
  },
};
const COPY = LOCALIZED_COPY[LOCALE];

// ============================================
// CONFIG
// ============================================

const CONFIG = {
  productName: "AiVerse",
  tagline: COPY.tagline,
  features: COPY.features,
  cta: COPY.cta,
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
  { id: "outro", duration: Math.round(5 * FPS) },
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
  const PROMPT_TEXT = COPY.promptText;

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
              {COPY.promptLabel}
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

const VIDEO_GENS = [
  "video-gens/video-gen-1.MOV",
  "video-gens/video-gen-2.MP4",
  "video-gens/video-gen-3.MOV",
];

const VideoFeatureScene: React.FC<{
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
            justifyContent: "flex-start",
            gap: 40,
            paddingTop: 80,
          }}
        >
          {/* Text at top */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              maxWidth: 960,
            }}
          >
            <FadeUp delay={0}>
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
            <FadeUp delay={8}>
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
            <FadeUp delay={16}>
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

          {/* Video examples — staggered zigzag layout */}
          <div
            style={{
              position: "relative",
              width: 680,
              height: 900,
            }}
          >
            {VIDEO_GENS.map((vid, i) => {
              const appearDelay = 15 + i * 12;
              const vidOpacity = interpolate(
                frame - appearDelay,
                [0, 12],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              const vidScale = interpolate(
                frame - appearDelay,
                [0, 12],
                [0.8, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.back(1.5)),
                }
              );
              // Zigzag: left, right, left
              const left = i % 2 === 0 ? 0 : 360;
              const top = i * 280;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left,
                    top,
                    opacity: vidOpacity,
                    transform: `scale(${vidScale})`,
                    width: 420,
                    height: 550,
                    borderRadius: 24,
                    overflow: "hidden",
                    border: "2px solid rgba(255,255,255,0.1)",
                    boxShadow: `0 0 40px rgba(168,85,247,${vidOpacity * 0.2})`,
                  }}
                >
                  <OffthreadVideo
                    src={staticFile(vid)}
                    volume={0}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 6: FEED FEATURE (Feature 3 - Feed with video in device)
// ============================================

const FeedFeatureScene: React.FC<{
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
// SCENE 7: STATS / OUTRO
// ============================================

const PACK_IMAGES = [
  "pack/photo00001.jpeg",
  "pack/photo00002.jpeg",
  "pack/photo00003.jpeg",
  "pack/photo00004.jpeg",
  "pack/photo00005.jpeg",
  "pack/photo00006.jpeg",
];

const OutroScene: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const stats = COPY.stats;

  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingTop: 100,
            gap: 60,
          }}
        >
          {/* Stats row at top */}
          <div
            style={{
              display: "flex",
              gap: 80,
              alignItems: "center",
            }}
          >
            {stats.map((stat, i) => (
              <FadeUp key={i} delay={5 + i * 8}>
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
                    delay={5 + i * 8}
                    style={{
                      fontFamily,
                      fontSize: 72,
                      fontWeight: 800,
                      color: CONFIG.accent,
                      letterSpacing: -1,
                    }}
                  />
                  <div
                    style={{
                      fontFamily,
                      fontSize: 24,
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

          {/* Photo gallery 3x2 grid (3 columns, 2 rows), 3:4 aspect ratio */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              width: 750,
            }}
          >
            {PACK_IMAGES.map((img, i) => {
              const appearDelay = 20 + i * 8;
              const imgOpacity = interpolate(
                frame - appearDelay,
                [0, 12],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              const imgScale = interpolate(
                frame - appearDelay,
                [0, 12],
                [0.8, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.back(1.5)),
                }
              );
              return (
                <div
                  key={i}
                  style={{
                    opacity: imgOpacity,
                    transform: `scale(${imgScale})`,
                    aspectRatio: "3 / 4",
                    borderRadius: 18,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: `0 0 30px rgba(168,85,247,${imgOpacity * 0.15})`,
                  }}
                >
                  <Img
                    src={staticFile(img)}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ============================================
// SCENE 8: CTA
// ============================================

const TelegramIcon: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 240 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="120" cy="120" r="120" fill="url(#tg-grad)" />
    <path
      d="M98 175c-3.6 0-3-1.4-4.2-4.8L82 131.5l89-53"
      fill="#C8DAEA"
    />
    <path
      d="M98 175c2.8 0 4-1.3 5.6-2.8l15-14.6-18.8-11.3"
      fill="#A9C9DD"
    />
    <path
      d="M99.8 146.3l45.4 33.5c5.2 2.9 8.9 1.4 10.2-4.8l18.4-86.8c1.9-7.5-2.9-10.9-7.8-8.7l-108 41.6c-7.3 2.9-7.2 7-1.3 8.8l27.7 8.6 64.2-40.5c3-1.8 5.8-.8 3.5 1.2"
      fill="#fff"
    />
    <defs>
      <linearGradient id="tg-grad" x1="120" y1="0" x2="120" y2="240">
        <stop stopColor="#2AABEE" />
        <stop offset="1" stopColor="#229ED9" />
      </linearGradient>
    </defs>
  </svg>
);

const CTAScene: React.FC<{ dur: number }> = ({ dur }) => {
  return (
    <SceneFade durationInFrames={dur}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        <Particles count={120} />
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 600px 400px at 50% 30%, rgba(168,85,247,0.15) 0%, transparent 70%), radial-gradient(ellipse 600px 400px at 50% 75%, rgba(39,160,228,0.1) 0%, transparent 70%)",
          }}
        />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
          {/* Top: Web App QR */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              paddingBottom: 50,
            }}
          >
            <FadeUp delay={0} duration={18}>
              <div
                style={{
                  fontFamily,
                  fontSize: 48,
                  fontWeight: 800,
                  color: "#fff",
                  textAlign: "center",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  padding: "16px 40px",
                  borderRadius: 20,
                  background:
                    "linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(168,85,247,0.08) 100%)",
                  border: "1px solid rgba(168,85,247,0.35)",
                  boxShadow:
                    "0 0 40px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                {CONFIG.url}
              </div>
            </FadeUp>
            <ScaleIn delay={8}>
              <div
                style={{
                  padding: 18,
                  backgroundColor: "#fff",
                  borderRadius: 24,
                  boxShadow:
                    "0 0 60px rgba(168,85,247,0.25), 0 0 120px rgba(168,85,247,0.1)",
                }}
              >
                <QRCode
                  value={`https://${CONFIG.url}`}
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                />
              </div>
            </ScaleIn>
            <FadeUp delay={14} duration={15}>
              <div
                style={{
                  fontFamily,
                  fontSize: 28,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.4)",
                  textAlign: "center",
                }}
              >
                Web App
              </div>
            </FadeUp>
          </div>

          {/* Divider line */}
          <FadeUp delay={16} duration={20}>
            <div
              style={{
                width: 500,
                height: 2,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.6) 30%, rgba(168,85,247,0.6) 70%, transparent 100%)",
              }}
            />
          </FadeUp>

          {/* Bottom: Telegram QR */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              paddingTop: 50,
            }}
          >
            <ScaleIn delay={18}>
              <div
                style={{
                  padding: 18,
                  backgroundColor: "#fff",
                  borderRadius: 24,
                  boxShadow:
                    "0 0 60px rgba(39,160,228,0.25), 0 0 120px rgba(39,160,228,0.1)",
                }}
              >
                <QRCode
                  value="https://t.me/aiverse_hub_bot"
                  size={220}
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                />
              </div>
            </ScaleIn>
            <FadeUp delay={24} duration={15}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 36px",
                  borderRadius: 20,
                  background:
                    "linear-gradient(135deg, rgba(39,160,228,0.25) 0%, rgba(39,160,228,0.08) 100%)",
                  border: "1px solid rgba(39,160,228,0.35)",
                  boxShadow:
                    "0 0 40px rgba(39,160,228,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                <TelegramIcon size={44} />
                <div
                  style={{
                    fontFamily,
                    fontSize: 42,
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: 0.5,
                  }}
                >
                  @aiverse_hub_bot
                </div>
              </div>
            </FadeUp>
          </div>
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

      {/* 5. Feature 2 - AI Video (video examples) */}
      <Sequence from={sceneStarts[4]} durationInFrames={SCENES[4].duration}>
        <VideoFeatureScene
          title={CONFIG.features[1].title}
          description={CONFIG.features[1].description}
          badge={CONFIG.features[1].badge}
          dur={SCENES[4].duration}
        />
      </Sequence>

      {/* 6. Feature 3 - Feed (video in device) */}
      <Sequence from={sceneStarts[5]} durationInFrames={SCENES[5].duration}>
        <FeedFeatureScene
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

      {/* Voiceover narration: intro first, then main body */}
      <Audio src={staticFile(VOICEOVER_INTRO_FILE)} volume={0.85} />
      <Sequence from={VOICEOVER_INTRO_DURATION_FRAMES}>
        <Audio src={staticFile(VOICEOVER_MAIN_FILE)} volume={0.85} />
      </Sequence>

      {/* Ambient background loop — under voiceover, very low */}
      <Audio
        src={staticFile("sfx/ambient-loop.mp3")}
        volume={0.08}
        loop
      />

      {/* Scene 1: Reveal — shine */}
      <Sequence from={sceneStarts[0]} durationInFrames={SCENES[0].duration}>
        <Audio src={staticFile("sfx/shine.mp3")} volume={0.25} />
      </Sequence>

      {/* Scene 2: Concept — typing then magic ding */}
      <Sequence from={sceneStarts[1]} durationInFrames={SCENES[1].duration}>
        <Audio src={staticFile("sfx/typing.mp3")} volume={0.2} />
      </Sequence>
      <Sequence
        from={sceneStarts[1] + Math.round(3.5 * FPS)}
        durationInFrames={Math.round(1.5 * FPS)}
      >
        <Audio src={staticFile("sfx/magic-ding.mp3")} volume={0.3} />
      </Sequence>

      {/* Scene 4: Model Icons — pop sounds staggered */}
      {AI_MODELS.map((_, i) => (
        <Sequence
          key={`pop-${i}`}
          from={sceneStarts[3] + Math.round(0.4 * FPS) + i * 4}
          durationInFrames={Math.round(0.5 * FPS)}
        >
          <Audio src={staticFile("sfx/pop.mp3")} volume={0.15} />
        </Sequence>
      ))}

      {/* Scene 7: Outro — counter tick */}
      <Sequence from={sceneStarts[6]} durationInFrames={SCENES[6].duration}>
        <Audio src={staticFile("sfx/counter.mp3")} volume={0.2} />
      </Sequence>

      {/* Scene 8: CTA — shine reveal */}
      <Sequence from={sceneStarts[7]} durationInFrames={SCENES[7].duration}>
        <Audio src={staticFile("sfx/shine.mp3")} volume={0.25} />
      </Sequence>
    </AbsoluteFill>
  );
};
