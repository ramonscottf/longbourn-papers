import { useState, useEffect } from "react";

const DEF_BLUE = "#1A3B69";
const DEF_LIGHT_BLUE = "#bed2e3";
const DEF_YELLOW = "#FFC958";

export default function NoKidGoesHungryLandingPage() {
  const [raised, setRaised] = useState(0);
  const goal = 85000;
  const [visible, setVisible] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setRaised(52340), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll("[data-animate]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const fadeIn = (id) =>
    visible[id]
      ? "opacity-1 translate-y-0"
      : "opacity-0 translate-y-4";

  const pct = Math.min((raised / goal) * 100, 100);

  const tiers = [
    { amount: "$10", impact: "Feeds a child for a week", icon: "🍎" },
    { amount: "$25", impact: "Clears one student's lunch debt", icon: "🎒" },
    { amount: "$100", impact: "Debt-free classroom", icon: "📚" },
    { amount: "$500", impact: "Covers a school's at-risk students", icon: "🏫" },
    { amount: "$2,500", impact: "Entire school at zero", icon: "⭐" },
  ];

  const stats = [
    { number: "92", label: "Schools" },
    { number: "72K+", label: "Students" },
    { number: "$0", label: "Our Goal for Lunch Debt" },
  ];

  return (
    <div style={{ fontFamily: "'Georgia', serif", color: "#1a1a1a", background: "#fff", minHeight: "100vh" }}>
      {/* HERO */}
      <section
        style={{
          background: `linear-gradient(135deg, ${DEF_BLUE} 0%, #0f2440 100%)`,
          minHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "3rem 1.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 20% 80%, ${DEF_YELLOW}15 0%, transparent 50%),
                         radial-gradient(circle at 80% 20%, ${DEF_LIGHT_BLUE}20 0%, transparent 40%)`,
          }}
        />
        <div style={{ position: "relative", textAlign: "center", maxWidth: "800px" }}>
          <p
            style={{
              color: DEF_YELLOW,
              fontSize: "0.85rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              marginBottom: "1rem",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 600,
            }}
          >
            Davis Education Foundation &bull; 2026 Gala Campaign
          </p>
          <h1
            style={{
              color: "#fff",
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 700,
              lineHeight: 1.1,
              margin: "0 0 1.5rem 0",
            }}
          >
            No Kid
            <br />
            Goes Hungry
          </h1>
          <p
            style={{
              color: DEF_LIGHT_BLUE,
              fontSize: "clamp(1rem, 2.5vw, 1.35rem)",
              lineHeight: 1.6,
              maxWidth: "600px",
              margin: "0 auto 2.5rem",
            }}
          >
            A campaign to eliminate every dollar of student lunch debt
            across Davis School District. Because no child should carry
            a debt they didn't choose.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              style={{
                background: DEF_YELLOW,
                color: DEF_BLUE,
                border: "none",
                padding: "1rem 2.5rem",
                fontSize: "1.05rem",
                fontWeight: 700,
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                letterSpacing: "0.02em",
                transition: "transform 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.target.style.transform = "translateY(0)")}
            >
              Donate Now — Wipe the Slate Clean
            </button>
            <button
              style={{
                background: "transparent",
                color: "#fff",
                border: "2px solid rgba(255,255,255,0.3)",
                padding: "1rem 2rem",
                fontSize: "1rem",
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.borderColor = DEF_YELLOW)}
              onMouseLeave={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
            >
              Learn More ↓
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: "2rem",
            left: "50%",
            transform: "translateX(-50%)",
            animation: "bounce 2s infinite",
          }}
        >
          <div
            style={{
              width: "28px",
              height: "44px",
              borderRadius: "14px",
              border: "2px solid rgba(255,255,255,0.3)",
              display: "flex",
              justifyContent: "center",
              paddingTop: "8px",
            }}
          >
            <div
              style={{
                width: "3px",
                height: "8px",
                background: DEF_YELLOW,
                borderRadius: "2px",
                animation: "scrollDot 2s infinite",
              }}
            />
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section
        style={{
          background: DEF_BLUE,
          borderTop: `4px solid ${DEF_YELLOW}`,
          padding: "2.5rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "2rem",
            textAlign: "center",
          }}
        >
          {stats.map((s, i) => (
            <div key={i}>
              <div
                style={{
                  color: DEF_YELLOW,
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {s.number}
              </div>
              <div
                style={{
                  color: DEF_LIGHT_BLUE,
                  fontSize: "0.85rem",
                  fontFamily: "system-ui, sans-serif",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  marginTop: "0.25rem",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* THE PROBLEM */}
      <section
        id="problem"
        data-animate
        style={{
          padding: "5rem 1.5rem",
          maxWidth: "750px",
          margin: "0 auto",
          transition: "all 0.8s ease",
        }}
        className={fadeIn("problem")}
      >
        <p
          style={{
            color: DEF_YELLOW,
            fontSize: "0.8rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            marginBottom: "0.75rem",
          }}
        >
          The Problem
        </p>
        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            color: DEF_BLUE,
            lineHeight: 1.2,
            marginBottom: "2rem",
          }}
        >
          This Shouldn't Be Happening.
        </h2>
        <p style={{ fontSize: "1.15rem", lineHeight: 1.8, color: "#444", marginBottom: "1.5rem" }}>
          Imagine being eleven years old. Your mom works two jobs. Your dad picks up
          extra shifts. They earn just a little too much to qualify for free lunch—but
          never quite enough.
        </p>
        <p style={{ fontSize: "1.15rem", lineHeight: 1.8, color: "#444", marginBottom: "1.5rem" }}>
          So your balance goes negative. One day, instead of the hot lunch your
          friends are eating, you get a cold sandwich on a separate tray. Everyone
          sees it. Everyone knows what it means.
        </p>
        <p style={{ fontSize: "1.15rem", lineHeight: 1.8, color: "#444", marginBottom: "1.5rem" }}>
          So you stop going. You sit in the library instead. You tell your teacher
          you're not hungry. But by fifth period, you can't focus. Your stomach is
          louder than the lesson.
        </p>
        <div
          style={{
            borderLeft: `4px solid ${DEF_YELLOW}`,
            background: "#f8f9fb",
            padding: "1.5rem 2rem",
            marginTop: "2rem",
            fontStyle: "italic",
            color: DEF_BLUE,
            fontSize: "1.1rem",
            lineHeight: 1.7,
          }}
        >
          This isn't a hypothetical. It happens every day in our schools. And it's
          entirely preventable.
        </div>
      </section>

      {/* PROGRESS BAR */}
      <section
        id="progress"
        data-animate
        style={{
          background: "#f5f8fb",
          padding: "4rem 1.5rem",
          transition: "all 0.8s ease",
        }}
        className={fadeIn("progress")}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
              color: DEF_BLUE,
              marginBottom: "0.5rem",
            }}
          >
            Help Us Get to Zero
          </h2>
          <p
            style={{
              color: "#666",
              fontFamily: "system-ui, sans-serif",
              marginBottom: "2rem",
            }}
          >
            Every dollar goes directly to student lunch balances.
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.9rem",
              color: "#888",
              marginBottom: "0.5rem",
            }}
          >
            <span>
              <strong style={{ color: DEF_BLUE, fontSize: "1.4rem" }}>
                ${raised.toLocaleString()}
              </strong>{" "}
              raised
            </span>
            <span style={{ color: "#aaa" }}>Goal: ${goal.toLocaleString()}</span>
          </div>
          <div
            style={{
              background: "#e0e7ee",
              borderRadius: "8px",
              height: "18px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                background: `linear-gradient(90deg, ${DEF_BLUE}, ${DEF_YELLOW})`,
                height: "100%",
                borderRadius: "8px",
                width: `${pct}%`,
                transition: "width 2s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
          <p
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: "0.85rem",
              color: "#999",
              marginTop: "0.75rem",
            }}
          >
            {Math.round(pct)}% of goal reached
          </p>
          <button
            style={{
              background: DEF_YELLOW,
              color: DEF_BLUE,
              border: "none",
              padding: "1rem 3rem",
              fontSize: "1.05rem",
              fontWeight: 700,
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              marginTop: "1.5rem",
            }}
          >
            Donate Now
          </button>
        </div>
      </section>

      {/* DONATION TIERS */}
      <section
        id="tiers"
        data-animate
        style={{
          padding: "5rem 1.5rem",
          maxWidth: "950px",
          margin: "0 auto",
          transition: "all 0.8s ease",
        }}
        className={fadeIn("tiers")}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p
            style={{
              color: DEF_YELLOW,
              fontSize: "0.8rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "system-ui, sans-serif",
              fontWeight: 600,
              marginBottom: "0.75rem",
            }}
          >
            Your Impact
          </p>
          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.4rem)",
              color: DEF_BLUE,
            }}
          >
            Your Gift. Their Fresh Start.
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {tiers.map((tier, i) => (
            <div
              key={i}
              style={{
                border: `2px solid ${i === 2 ? DEF_YELLOW : "#e8edf2"}`,
                borderRadius: "8px",
                padding: "2rem 1.25rem",
                textAlign: "center",
                background: i === 2 ? "#fffdf5" : "#fff",
                position: "relative",
                transition: "transform 0.2s, box-shadow 0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(26,59,105,0.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {i === 2 && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: DEF_YELLOW,
                    color: DEF_BLUE,
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "3px 12px",
                    borderRadius: "10px",
                  }}
                >
                  Most Popular
                </div>
              )}
              <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{tier.icon}</div>
              <div
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 700,
                  color: DEF_BLUE,
                  marginBottom: "0.5rem",
                }}
              >
                {tier.amount}
              </div>
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#666",
                  lineHeight: 1.5,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {tier.impact}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* QUOTE */}
      <section
        style={{
          background: DEF_BLUE,
          padding: "4rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div
            style={{
              color: DEF_YELLOW,
              fontSize: "4rem",
              lineHeight: 0.5,
              marginBottom: "1.5rem",
            }}
          >
            "
          </div>
          <p
            style={{
              color: "#fff",
              fontSize: "clamp(1.2rem, 3vw, 1.6rem)",
              lineHeight: 1.7,
              fontStyle: "italic",
            }}
          >
            In a perfect world, every child eats for free. Until we get there, we
            make sure no student in Davis District goes without.
          </p>
          <div
            style={{
              width: "40px",
              height: "3px",
              background: DEF_YELLOW,
              margin: "1.5rem auto 1rem",
            }}
          />
          <p
            style={{
              color: DEF_LIGHT_BLUE,
              fontSize: "0.9rem",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Davis Education Foundation
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="howitworks"
        data-animate
        style={{
          padding: "5rem 1.5rem",
          maxWidth: "800px",
          margin: "0 auto",
          transition: "all 0.8s ease",
        }}
        className={fadeIn("howitworks")}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)", color: DEF_BLUE }}>
            How It Works
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "2rem",
            textAlign: "center",
          }}
        >
          {[
            { step: "01", title: "You Donate", desc: "Give any amount online, at the gala, or by check." },
            {
              step: "02",
              title: "We Apply It",
              desc: "100% goes directly to student lunch balances across Davis District.",
            },
            {
              step: "03",
              title: "A Child Eats",
              desc: "A student walks through the lunch line without fear or shame.",
            },
          ].map((item, i) => (
            <div key={i}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: i === 2 ? DEF_YELLOW : DEF_LIGHT_BLUE,
                  color: DEF_BLUE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1rem",
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                }}
              >
                {item.step}
              </div>
              <h3
                style={{
                  color: DEF_BLUE,
                  fontSize: "1.15rem",
                  marginBottom: "0.5rem",
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  color: "#666",
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section
        style={{
          background: `linear-gradient(135deg, ${DEF_BLUE} 0%, #0f2440 100%)`,
          padding: "5rem 1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2
            style={{
              color: "#fff",
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              marginBottom: "1rem",
              lineHeight: 1.2,
            }}
          >
            Every child deserves a full tray and zero shame.
          </h2>
          <p
            style={{
              color: DEF_LIGHT_BLUE,
              fontSize: "1.1rem",
              lineHeight: 1.7,
              marginBottom: "2rem",
            }}
          >
            They didn't choose this debt. You can choose to erase it.
          </p>
          <button
            style={{
              background: DEF_YELLOW,
              color: DEF_BLUE,
              border: "none",
              padding: "1.15rem 3rem",
              fontSize: "1.1rem",
              fontWeight: 700,
              borderRadius: "4px",
              cursor: "pointer",
              fontFamily: "system-ui, sans-serif",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.transform = "scale(1.03)")}
            onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
          >
            Donate Now
          </button>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.8rem",
              fontFamily: "system-ui, sans-serif",
              marginTop: "1.25rem",
            }}
          >
            100% of campaign donations go to eliminating student lunch debt.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: "#0a1929",
          padding: "2rem 1.5rem",
          textAlign: "center",
          color: "rgba(255,255,255,0.35)",
          fontSize: "0.8rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <p style={{ marginBottom: "0.25rem" }}>
          Davis Education Foundation &bull; Supporting 72,000+ Students Across Davis
          School District
        </p>
        <p>#NoKidGoesHungry</p>
      </footer>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        @keyframes scrollDot {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(6px); }
        }
        .opacity-0 { opacity: 0; }
        .opacity-1 { opacity: 1; }
        .translate-y-0 { transform: translateY(0); }
        .translate-y-4 { transform: translateY(20px); }
      `}</style>
    </div>
  );
}
