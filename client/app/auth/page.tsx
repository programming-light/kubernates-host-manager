'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, ArrowRight, Loader2, Shield, Copy, CheckCircle, AlertCircle } from 'lucide-react';

type AuthStep = 'email' | 'otp' | 'profile';

interface AuthResponse {
  requiresOTP?: boolean;
  emailSent?: boolean;
  devMode?: boolean;
  otp?: string;
  isNewUser?: boolean;
  message?: string;
}

export default function AuthPage() {
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isDevMode, setIsDevMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOTP = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/auth', { email });
      const data: AuthResponse = await response.json();
      
      if (data.requiresOTP) {
        setStep('otp');
        setCountdown(60);
        setGeneratedOtp(data.otp || '');
        setIsDevMode(data.devMode || false);
        
        if (data.emailSent) {
          toast.success('OTP sent to your email!');
        } else if (data.devMode && data.otp) {
          toast.success(`OTP: ${data.otp}`, {
            duration: 10000,
          });
        } else {
          toast.success('OTP generated (check server console)');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleVerifyOTP = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/auth/otp/verify', { email, otp });
      const data = await response.json();

      if (data.accessToken && data.refreshToken) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        if (data.isComplete) {
          const userResponse = await api.get('/auth/me');
          if (userResponse.ok) {
            const user = await userResponse.json();
            setUser(user);
          }
          toast.success('Welcome back!');
          router.push('/dashboard');
        } else {
          setStep('profile');
        }
        return;
      }
    } catch (error: any) {
      toast.error(error.message || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  }, [email, otp, router, setUser]);

  const handleCompleteProfile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/auth/complete-profile', { name });
      if (response.ok) {
        const userResponse = await api.get('/auth/me');
        if (userResponse.ok) {
          const user = await userResponse.json();
          setUser(user);
        }
        toast.success('Profile completed!');
        router.push('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  }, [name, router, setUser]);

  const handleResendOTP = useCallback(async () => {
    if (countdown > 0) return;
    setOtp('');
    setGeneratedOtp('');
    await handleSendOTP();
  }, [countdown, handleSendOTP]);

  const handleBack = useCallback(() => {
    setStep('email');
    setOtp('');
    setGeneratedOtp('');
    setName('');
  }, []);

  const copyOtp = useCallback(async () => {
    if (generatedOtp) {
      await navigator.clipboard.writeText(generatedOtp);
      setCopied(true);
      toast.success('OTP copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedOtp]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 h-full w-full rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">K8s Platform</h1>
          <p className="mt-2 text-gray-400">Sign in or create an account</p>
        </div>

        <Card className="border-gray-800 bg-gray-900/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            {step === 'email' && (
              <>
                <CardTitle className="text-xl text-white">Enter your email</CardTitle>
                <CardDescription className="text-gray-400">
                  We&apos;ll send you a verification code
                </CardDescription>
              </>
            )}
            {step === 'otp' && (
              <>
                <CardTitle className="text-xl text-white">Check your email</CardTitle>
                <CardDescription className="text-gray-400">
                  Enter the 6-digit code sent to {email}
                </CardDescription>
              </>
            )}
            {step === 'profile' && (
              <>
                <CardTitle className="text-xl text-white">Complete your profile</CardTitle>
                <CardDescription className="text-gray-400">
                  Tell us your name to get started
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {step === 'email' && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="border-gray-700 bg-gray-800 pl-10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <div className="space-y-4">
                {isDevMode && generatedOtp && (
                  <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                    <div className="mb-2 flex items-center gap-2 text-blue-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Development Mode</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-400">Your OTP:</p>
                        <p className="text-2xl font-mono font-bold text-white">{generatedOtp}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={copyOtp}
                        className="text-gray-400 hover:text-white"
                      >
                        {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-gray-300">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="border-gray-700 bg-gray-800 text-center text-2xl tracking-widest font-mono text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading || otp.length !== 6}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </form>

                <div className="text-center text-sm">
                  {countdown > 0 ? (
                    <span className="text-gray-500">Resend in {countdown}s</span>
                  ) : (
                    <button type="button" onClick={handleResendOTP} className="text-blue-500 hover:underline">
                      Resend code
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-400"
                >
                  Use a different email
                </button>
              </div>
            )}

            {step === 'profile' && (
              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-300">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading || !name.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Complete Profile'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-400"
                >
                  Go back
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-xs text-gray-500">
              <p>OTP expires in 5 minutes</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}