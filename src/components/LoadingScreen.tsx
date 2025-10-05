import { Shield } from "lucide-react";

const LoadingScreen = () => {
  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-6">
        <div className="mx-auto w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-finmo-lg animate-pulse">
          <Shield className="w-10 h-10 text-primary-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-primary-foreground">FinMo</h2>
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-primary-foreground rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
