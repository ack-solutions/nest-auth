import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.shell}>
      <div className={styles.grid} aria-hidden />
      <div className={`${styles.orb} ${styles.orbA}`} aria-hidden />
      <div className={`${styles.orb} ${styles.orbB}`} aria-hidden />
      <div className={`${styles.orb} ${styles.orbC}`} aria-hidden />

      <Hero />
      <FeaturesSection />
      <FlowSection />
      <CodeSection />
      <StatsSection />
      <PackagesSection />
      <FinalCta />
      <div className={styles.fadeBottom} aria-hidden />
    </div>
  );
}

/* ---------- Hero ---------- */

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.pill}>
        <span className={styles.pillDot} />
        v2.0.0-beta · MIT licensed · works with NestJS 10 &amp; 11
      </div>

      <h1 className={styles.headline}>
        Authentication that
        <br />
        <span className={styles.headlineAccent}>scales with your stack</span>
      </h1>

      <p className={styles.lead}>
        Sessions, MFA, OAuth, passwordless, multi-tenancy, RBAC, and an embedded admin console — for NestJS, JavaScript, and React. Type-safe end to end.
      </p>

      <div className={styles.ctaRow}>
        <Link href="/docs" className={`${styles.btn} ${styles.btnPrimary}`}>
          Read the docs
          <ArrowRight className={styles.btnIcon} />
        </Link>
        <Link href="/docs/getting-started/quickstart-backend" className={`${styles.btn} ${styles.btnGhost}`}>
          Quickstart
        </Link>
        <a
          href="https://github.com/ack-solutions/nest-auth"
          target="_blank"
          rel="noreferrer"
          className={`${styles.btn} ${styles.btnGhost}`}
        >
          <GithubMark />
          GitHub
        </a>
      </div>

      <div className={styles.terminal}>
        <span className={styles.prompt}>$</span>
        <span>pnpm add @ackplus/nest-auth</span>
        <span className={styles.copy}>Copy</span>
      </div>

      <div className={styles.marquee} aria-label="Supported sign-in providers">
        <div className={styles.marqueeTrack}>
          {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
            <span key={i} className={styles.marqueeItem}>
              {p.icon}
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */

function FeaturesSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 className={styles.sectionTitle}>Everything production auth needs</h2>
        <p className={styles.sectionLead}>
          Nine ways to sign in, four MFA factors, three session backends — all wired up the moment you import the module.
        </p>
      </div>

      <div className={styles.featureGrid}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.feature}>
            <div className={styles.featureIcon}>{f.icon}</div>
            <h3 className={styles.featureTitle}>{f.title}</h3>
            <p className={styles.featureDesc}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Flow visualization ---------- */

function FlowSection() {
  const steps = [
    { title: 'Request', sub: 'POST /auth/login' },
    { title: 'Verify', sub: 'credentials + MFA' },
    { title: 'Session', sub: 'DB / Redis / memory' },
    { title: 'Tokens', sub: 'JWT or HttpOnly cookie' },
    { title: 'Protected', sub: 'guards + roles + RBAC' },
  ];

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 className={styles.sectionTitle}>One flow, every method</h2>
        <p className={styles.sectionLead}>
          Whether the user signs in with email, a magic link, or Google, the path is the same — and every step is a hook you can extend.
        </p>
      </div>

      <div className={styles.flow}>
        <div className={styles.flowGlow} aria-hidden />
        <div className={styles.flowInner}>
          {steps.map((s, i) => (
            <FlowItem key={s.title} index={i} step={s} last={i === steps.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FlowItem({
  step,
  last,
  index,
}: {
  step: { title: string; sub: string };
  last: boolean;
  index: number;
}) {
  return (
    <>
      <div className={styles.flowNode}>
        {step.title}
        <small>{step.sub}</small>
      </div>
      {!last && (
        <div className={styles.flowArrow} style={{ animationDelay: `${index * 0.4}s` }} aria-hidden>
          <svg viewBox="0 0 32 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="0" y1="7" x2="28" y2="7" />
            <polyline points="22,2 28,7 22,12" />
          </svg>
        </div>
      )}
    </>
  );
}

/* ---------- Code preview ---------- */

function CodeSection() {
  return (
    <section className={styles.section}>
      <div className={styles.split}>
        <div className={styles.codeWrap}>
          <div className={styles.codeGlow} aria-hidden />
          <div className={styles.codeWindow}>
            <div className={styles.codeChrome}>
              <div className={styles.codeDots}>
                <span /><span /><span />
              </div>
              <span className={styles.codeFile}>app.module.ts</span>
            </div>
            <pre className={styles.codeBody}>
<code>
<span className={styles.tokKw}>import</span>{' '}<span>{'{ Module }'}</span>{' '}<span className={styles.tokKw}>from</span>{' '}<span className={styles.tokStr}>{"'@nestjs/common'"}</span>;{'\n'}
<span className={styles.tokKw}>import</span>{' '}<span>{'{ NestAuthModule, NestAuthEntities }'}</span>{'\n'}
{'  '}<span className={styles.tokKw}>from</span>{' '}<span className={styles.tokStr}>{"'@ackplus/nest-auth'"}</span>;{'\n\n'}
<span className={styles.tokDec}>@Module</span>{'({'}{'\n'}
{'  imports: ['}{'\n'}
{'    EventEmitterModule.'}<span className={styles.tokFn}>forRoot</span>{'(),'}{'\n'}
{'    TypeOrmModule.'}<span className={styles.tokFn}>forRoot</span>{'({ '}<span className={styles.tokCmt}>{'/* ... */'}</span>{','}{'\n'}
{'      entities: [...NestAuthEntities] }),'}{'\n'}
{'    TypeOrmModule.'}<span className={styles.tokFn}>forFeature</span>{'([...NestAuthEntities]),'}{'\n'}
{'    NestAuthModule.'}<span className={styles.tokFn}>forRoot</span>{'({'}{'\n'}
{'      appName: '}<span className={styles.tokStr}>{"'My App'"}</span>{','}{'\n'}
{'      session: { jwt: { secret: process.env.JWT_SECRET! } },'}{'\n'}
{'    }),'}{'\n'}
{'  ],'}{'\n'}
{'})'}{'\n'}
<span className={styles.tokKw}>export class</span>{' '}<span className={styles.tokDec}>AppModule</span>{' {}'}
</code>
            </pre>
          </div>
        </div>

        <div>
          <h2 className={styles.stepsTitle}>
            Wire up auth in three lines.
          </h2>
          <p className={styles.stepsLead}>
            Drop <code>NestAuthModule</code> into your <code>AppModule</code>, register the entities, and you have signup, login, refresh, password reset, MFA, OAuth, and the rest of the API surface — all configurable via hooks and events.
          </p>
          <ul className={styles.checks}>
            {[
              'Hook-driven extension surface — every lifecycle moment is overridable',
              'NestAuthUser stores auth fields only — your AppUser holds the business data',
              'Event emitter for async side effects (welcome emails, audit, role sync)',
              'Database, Redis, or in-memory session backends',
            ].map((point) => (
              <li key={point} className={styles.check}>
                <Check className={styles.checkIcon} />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className={styles.stepsCtas}>
            <Link href="/docs/getting-started/quickstart-backend" className={`${styles.btn} ${styles.btnPrimary}`}>
              Backend quickstart
              <ArrowRight className={styles.btnIcon} />
            </Link>
            <Link href="/docs/getting-started/quickstart-react" className={`${styles.btn} ${styles.btnGhost}`}>
              React quickstart
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Stats ---------- */

function StatsSection() {
  return (
    <section className={styles.section}>
      <div className={styles.stats}>
        {STATS.map((s) => (
          <div key={s.label} className={styles.stat}>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Packages ---------- */

function PackagesSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 className={styles.sectionTitle}>Four packages, one version</h2>
        <p className={styles.sectionLead}>
          Pick the layer you need; types are shared across all of them.
        </p>
      </div>

      <div className={styles.packages}>
        {PACKAGES.map((p) => (
          <Link key={p.name} href={p.href} className={styles.package}>
            <div className={styles.packageIcon}>{p.icon}</div>
            <div className={styles.packageName}>{p.name}</div>
            <p className={styles.packageDesc}>{p.desc}</p>
            <div className={styles.packageArrow}>Read the docs →</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */

function FinalCta() {
  return (
    <section className={styles.finalCta}>
      <div className={styles.ctaCard}>
        <div className={styles.ctaCardInner}>
          <h2 className={styles.ctaCardTitle}>Ship auth, not boilerplate.</h2>
          <p className={styles.ctaCardLead}>
            Replace four libraries and a thousand lines of glue with one well-tested module. Designed for production from the first commit.
          </p>
          <div className={styles.ctaCardActions}>
            <Link href="/docs/getting-started/installation" className={`${styles.btn} ${styles.btnPrimary}`}>
              Install in 5 minutes
              <ArrowRight className={styles.btnIcon} />
            </Link>
            <a
              href="https://github.com/ack-solutions/nest-auth"
              target="_blank"
              rel="noreferrer"
              className={`${styles.btn} ${styles.btnGhost}`}
            >
              <GithubMark />
              Star on GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Icons ---------- */

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.296a1 1 0 0 1 0 1.408l-7.5 7.5a1 1 0 0 1-1.408 0l-3.5-3.5a1 1 0 1 1 1.408-1.408L8.5 12.092l6.796-6.796a1 1 0 0 1 1.408 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GithubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.96 10.96 0 0 1 5.74 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/* feature icons */

function SessionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M8 14h2M8 17h6" />
    </svg>
  );
}

function MfaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function OAuthIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function TenantIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" />
    </svg>
  );
}

function RbacIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M3 21a9 9 0 0 1 18 0" />
    </svg>
  );
}

function HookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4v7a3 3 0 0 1-6 0V7" />
      <circle cx="11" cy="20" r="2" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function TypesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h14M9 20V4M15 20V12" />
    </svg>
  );
}

function NestIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 7v10l8 5 8-5V7l-8-5Z" />
      <path d="M12 22V12M4 7l8 5 8-5" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z" />
      <path d="m3 8 9 5 9-5M12 13v10" />
    </svg>
  );
}

function ReactIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="11" ry="4" />
      <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(120 12 12)" />
    </svg>
  );
}

function GoogleDot() {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4285F4', display: 'inline-block' }} />;
}
function FbDot() { return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1877F2', display: 'inline-block' }} />; }
function AppleDot() { return <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />; }
function GhDot() { return <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block', opacity: 0.85 }} />; }

/* ---------- data ---------- */

const FEATURES = [
  { title: 'Sessions you can trust', desc: 'JWT access + refresh, header or HttpOnly-cookie mode, auto-refresh, refresh-queue dedup, password-hash-prefix invalidation.', icon: <SessionIcon /> },
  { title: 'MFA built in',          desc: 'TOTP, Email OTP, SMS OTP, recovery codes, and trusted-device tokens — opt-in or required.',                                       icon: <MfaIcon /> },
  { title: 'Every login method',    desc: 'Email, phone, Google, Facebook, Apple, GitHub, passwordless, magic link, custom OAuth, API keys.',                                icon: <OAuthIcon /> },
  { title: 'Multi-tenant first',    desc: 'Disabled, shared, or fully isolated modes. Tenant-aware decorators and request context out of the box.',                          icon: <TenantIcon /> },
  { title: 'RBAC with multiple guards', desc: 'Roles and permissions per guard namespace (web, api, mobile). Decorator-driven; external IDP friendly.',                       icon: <RbacIcon /> },
  { title: 'Hook-driven extension', desc: 'Every lifecycle moment is overridable — beforeSignup, onLogin, customizeSessionData, resolveRoles, and more.',                     icon: <HookIcon /> },
  { title: 'Embedded admin console',desc: 'A polished React UI for managing users, roles, permissions, tenants, and API keys. Zero deploy work.',                              icon: <AdminIcon /> },
  { title: 'Type-safe end to end',  desc: 'Shared contracts package powers backend, JS client, and React layer — break a DTO, break the build.',                              icon: <TypesIcon /> },
  { title: 'Production-ready defaults', desc: 'Argon2id hashing, refresh-token rotation, sensible cookie flags, audit hook, structured error codes.',                          icon: <NestIcon /> },
];

const STATS = [
  { value: '9',       label: 'Auth methods' },
  { value: '14',      label: 'Entities included' },
  { value: '12',      label: 'Doc sections' },
  { value: '<10 min', label: 'To first login' },
];

const PACKAGES = [
  { name: '@ackplus/nest-auth',           desc: 'NestJS backend module — controllers, guards, decorators, services.', href: '/docs/backend',              icon: <NestIcon /> },
  { name: '@ackplus/nest-auth-client',    desc: 'Framework-agnostic JS/TS client. Works in browsers, Node, RN.',     href: '/docs/client',               icon: <PackageIcon /> },
  { name: '@ackplus/nest-auth-react',     desc: 'React provider, hooks, guards, and Next.js App Router helpers.',     href: '/docs/react',                icon: <ReactIcon /> },
  { name: '@ackplus/nest-auth-contracts', desc: 'Shared TS types — consumed by all three packages.',                  href: '/docs/api-reference/types',  icon: <TypesIcon /> },
];

const PROVIDERS = [
  { label: 'Email + Password', icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: 'currentColor', display: 'inline-block', opacity: 0.7 }} /> },
  { label: 'Phone OTP',        icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: 'currentColor', display: 'inline-block', opacity: 0.7 }} /> },
  { label: 'Google',           icon: <GoogleDot /> },
  { label: 'Facebook',         icon: <FbDot /> },
  { label: 'Apple',            icon: <AppleDot /> },
  { label: 'GitHub',           icon: <GhDot /> },
  { label: 'Magic Link',       icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block', opacity: 0.6 }} /> },
  { label: 'TOTP / MFA',       icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: 'currentColor', display: 'inline-block', opacity: 0.7 }} /> },
  { label: 'API Keys',         icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: 'currentColor', display: 'inline-block', opacity: 0.7 }} /> },
  { label: 'Custom OAuth',     icon: <span style={{ width: 8, height: 8, borderRadius: 2, background: 'currentColor', display: 'inline-block', opacity: 0.7 }} /> },
];
