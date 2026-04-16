import { SignIn } from '@clerk/clerk-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6f7]">
      <SignIn
        routing="hash"
        afterSignInUrl="/portfolios"
        signUpUrl="/signup"
      />
    </div>
  )
}
