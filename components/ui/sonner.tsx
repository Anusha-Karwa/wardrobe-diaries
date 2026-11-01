"use client";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="top-center"
    toastOptions={{ classNames: { toast: "rounded-2xl" } }}
    {...props}
  />
);

export { Toaster };
