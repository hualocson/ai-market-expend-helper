"use client";

import { useAppHaptics } from "@/hooks/useAppHaptics";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Hand,
  MousePointer2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const buttonClassName = "h-12 justify-start rounded-xl px-4";

const HapticsTestPanel = () => {
  const haptics = useAppHaptics();

  return (
    <section className="grid gap-3" aria-label="Haptic triggers">
      <Button
        type="button"
        className={buttonClassName}
        onClick={() => haptics.success()}
      >
        <CircleCheck className="size-4" />
        Success
      </Button>
      <Button
        type="button"
        variant="secondary"
        className={buttonClassName}
        onClick={() => haptics.warning()}
      >
        <CircleAlert className="size-4" />
        Warning
      </Button>
      <Button
        type="button"
        variant="destructive"
        className={buttonClassName}
        onClick={() => haptics.error()}
      >
        <CircleX className="size-4" />
        Error
      </Button>
      <Button
        type="button"
        variant="outline"
        className={buttonClassName}
        onClick={() => haptics.selection()}
      >
        <MousePointer2 className="size-4" />
        Selection
      </Button>
      <Button
        type="button"
        variant="outline"
        className={buttonClassName}
        onClick={() => haptics.impact("light")}
      >
        <Hand className="size-4" />
        Light impact
      </Button>
      <Button
        type="button"
        variant="outline"
        className={buttonClassName}
        onClick={() => haptics.impact("medium")}
      >
        <Hand className="size-4" />
        Medium impact
      </Button>
      <Button
        type="button"
        variant="outline"
        className={buttonClassName}
        onClick={() => haptics.impact("heavy")}
      >
        <Hand className="size-4" />
        Heavy impact
      </Button>
      <Button
        type="button"
        variant="secondary"
        className={buttonClassName}
        onClick={() => haptics.trigger()}
      >
        <Zap className="size-4" />
        Default trigger
      </Button>
    </section>
  );
};

export default HapticsTestPanel;
