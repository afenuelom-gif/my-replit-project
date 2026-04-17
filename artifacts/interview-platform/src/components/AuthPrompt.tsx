import React from "react";
import { useClerk } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";

export function AuthPrompt() {
  const { openSignIn, openSignUp } = useClerk();
  const redirectUrl = window.location.href;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute -top-32 -left-48 w-[600px] h-[600px] rounded-full bg-purple-600/15 blur-[90px]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <CardContent className="py-10 text-center space-y-5">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-white">Your session has expired</p>
              <p className="text-zinc-400 text-sm max-w-sm mx-auto">
                Please sign back in to continue. You'll be returned here automatically after signing in.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                className="flex-1 sm:flex-none sm:min-w-[140px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0 gap-2"
                onClick={() => openSignIn({ redirectUrl })}
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none sm:min-w-[140px] border-white/20 text-white hover:bg-white/10 gap-2"
                onClick={() => openSignUp({ redirectUrl })}
              >
                <UserPlus className="w-4 h-4" />
                Create Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
