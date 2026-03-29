"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  if (typeof document === "undefined") {
    return () => {};
  }

  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-flow"],
  });

  return () => observer.disconnect();
}

function getSnapshot() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.documentElement.getAttribute("data-flow") === "true";
}

export function useFlowMode(initialFlow = false) {
  return useSyncExternalStore(subscribe, getSnapshot, () => initialFlow);
}
