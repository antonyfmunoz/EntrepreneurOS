import { SignIn } from '@clerk/clerk-react'
import { eosClerkAppearance } from '@/lib/clerk-appearance'
import { safeInternalReturnPath } from '@/lib/safe-return'

export default function LoginPage() {
  const returnTo = safeInternalReturnPath(new URLSearchParams(window.location.search).get('returnTo'))
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#f5f6f7] px-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#6a37d4] font-semibold text-white">EO</div>
        <h1 className="text-2xl font-semibold text-[#2c2f30]">Sign in to EntrepreneurOS</h1>
        <p className="mt-1 text-sm text-[#595c5d]">Continue to your governed company workspace.</p>
      </div>
      <SignIn
        routing="hash"
        fallbackRedirectUrl={returnTo}
        forceRedirectUrl={returnTo}
        signUpUrl={`/signup?returnTo=${encodeURIComponent(returnTo)}`}
        appearance={eosClerkAppearance}
      />
    </div>
  )
}
