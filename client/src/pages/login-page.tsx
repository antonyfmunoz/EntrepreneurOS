import { SignIn } from '@clerk/clerk-react'
import { eosClerkAppearance } from '@/lib/clerk-appearance'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#f5f6f7] px-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#6a37d4] font-semibold text-white">EO</div>
        <h1 className="text-2xl font-semibold text-[#2c2f30]">Sign in to EntrepreneurOS</h1>
        <p className="mt-1 text-sm text-[#595c5d]">Continue to your governed company workspace.</p>
      </div>
      <SignIn
        routing="hash"
        fallbackRedirectUrl="/portfolios"
        signUpUrl="/signup"
        appearance={eosClerkAppearance}
      />
    </div>
  )
}
