import { SignUp } from '@clerk/clerk-react'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6f7]">
      <SignUp
        routing="hash"
        afterSignUpUrl="/company-setup"
        signInUrl="/login"
      />
    </div>
  )
}
