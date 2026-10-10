# MFA (React)

Needs `mfa.enabled` on the backend. Methods the backend may offer: `totp` (authenticator app), `email`, `sms`.

## The MFA step on login

`login` resolves with `isRequiresMfa: true`. The user is not signed in until the second step succeeds.

```tsx
import { useState } from 'react';
import { useNestAuth } from '@ackplus/nest-auth-react';
import { NestAuthMFAMethodEnum } from '@ackplus/nest-auth-client';
import type { IAuthResponse } from '@ackplus/nest-auth-client';

export function MfaStep({ loginResult, onDone }: { loginResult: IAuthResponse; onDone: () => void }) {
  const { send2fa, verify2fa, verifyRecoveryCode } = useNestAuth();
  const methods = loginResult.mfaMethods ?? [NestAuthMFAMethodEnum.TOTP];
  const [method, setMethod] = useState(loginResult.defaultMfaMethod ?? methods[0]);
  const [otp, setOtp] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);

  async function choose(next: NestAuthMFAMethodEnum) {
    setMethod(next);
    if (next === NestAuthMFAMethodEnum.EMAIL) await send2fa('email');
    if (next === NestAuthMFAMethodEnum.SMS) await send2fa('phone');
    // TOTP: nothing to send; the user reads the code from their app
  }

  async function submit() {
    await verify2fa({ otp, method, trustDevice });
    onDone();
  }

  return (
    <div>
      {methods.map((m) => (
        <button key={m} onClick={() => choose(m)} aria-pressed={m === method}>{m}</button>
      ))}
      <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" />
      <label>
        <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
        Remember this device
      </label>
      <button onClick={submit}>Verify</button>
      <button onClick={async () => { await verifyRecoveryCode({ code: otp }); onDone(); }}>
        Use a recovery code
      </button>
    </div>
  );
}
```

Keep the `login` result (component state, router state) to render this step. Simplify freely: with a single method, drop the picker; "remember this device" and recovery codes are optional UI.

## Enrolment in account settings

```tsx
import { useState } from 'react';
import { useNestAuth } from '@ackplus/nest-auth-react';
import type { ITotpSetupResponse } from '@ackplus/nest-auth-client';

export function TotpSetup() {
  const { setupTotp, verifyTotpSetup, toggleMfa, generateRecoveryCode } = useNestAuth();
  const [setup, setSetup] = useState<ITotpSetupResponse | null>(null);
  const [otp, setOtp] = useState('');
  const [codes, setCodes] = useState<string[]>([]);

  async function confirm() {
    if (!setup) return;
    await verifyTotpSetup({ otp, secret: setup.secret });
    await toggleMfa({ enabled: true });
    const result = (await generateRecoveryCode()) as { code: string; codes?: string[] };
    setCodes(result.codes ?? [result.code]); // show once; the user saves them
  }

  if (codes.length) return <pre>{codes.join('\n')}</pre>;
  if (!setup) return <button onClick={async () => setSetup(await setupTotp())}>Set up authenticator</button>;
  return (
    <div>
      <img src={setup.qrCode} alt="Scan with your authenticator app" />
      <code>{setup.secret}</code>
      <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" />
      <button onClick={confirm}>Confirm</button>
    </div>
  );
}
```

Other calls: `getMfaStatus()`, `listTotpDevices()`, `removeTotpDevice(id)`, `toggleMfa({ enabled: false })`, `resetMfa(recoveryCode)`.

## Variations

- Email or SMS only: no enrolment screen is needed; the user just turns MFA on with `toggleMfa`.
- MFA mandatory on the backend (`mfa.required`): send users without a method to the enrolment screen after login.
- Render the QR yourself from `setup.otpAuthUrl` if the project has a QR component.
