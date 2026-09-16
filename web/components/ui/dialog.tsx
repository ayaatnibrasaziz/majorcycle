'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * ⚠️ RESTORE FOCUS TO WHATEVER OPENED THE DIALOG — audit 5A-112.
 *
 * Radix restores focus on close to `context.triggerRef.current`, which is set by
 * `<DialogTrigger>`. **Not one dialog in this app uses `DialogTrigger`** — every one is
 * controlled by external state (`open` / `onOpenChange`) and opened by an ordinary
 * button somewhere else in the tree. So that ref is null for all eight consumers, Radix
 * has nothing to focus, and focus falls to `<body>`.
 *
 * Measured on production: open the upgrade dialog from "Download Report", dismiss with
 * Escape or "Not now", and `document.activeElement` is BODY three seconds later — with
 * the trigger button still in the DOM, same node, so it was not an unmount. A keyboard
 * user is dropped at the top of the document and has to tab the whole sidebar and
 * header to get back to where they were, on the paywall-conversion surface.
 *
 * The opener is captured in `onOpenAutoFocus`, which Radix fires as the content mounts
 * and before it moves focus inside — so `document.activeElement` is still the reader's
 * last position. Not an effect (Radix's FocusScope has already moved focus by then) and
 * not the render body (reading a ref there is impure, and the React Compiler lint says
 * so — it caught the first version of this fix).
 *
 * ⚠️ What is NOT wrong here, checked before changing anything: `aria-modal` is absent,
 * and that is correct. Radix marks every sibling of the content `aria-hidden="true"`
 * instead — verified on the live page, where the app root carries it while the dialog
 * is open. Hiding the rest of the document is the stronger of the two mechanisms, and
 * an earlier reading of this as a second defect was wrong.
 *
 * ⚠️ **A HOOK, because there are now two kinds of content** — the centred modal below
 * and the edge-anchored `DialogDrawerContent` the signed-in shell opens on a phone
 * (Layer H · H1). Two copies of this handler pair is exactly 11c: close enough to read
 * together, far enough apart to drift, and the drift would be silent because focus
 * landing on `<body>` looks like nothing at all. One implementation, two consumers.
 */
function useOpenerFocusRestore() {
  const openerRef = React.useRef<HTMLElement | null>(null);
  return {
    /** Called as the content mounts, BEFORE Radix moves focus inside. */
    captureOpener: () => {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement ? active : null;
    },
    restoreOpener: (event: Event) => {
      const opener = openerRef.current;
      // Only take over when the consumer has not, and only when the opener is still
      // on the page — a stale node would send focus nowhere, which is the bug.
      if (!event.defaultPrevented && opener && document.body.contains(opener)) {
        event.preventDefault();
        opener.focus();
      }
    },
  };
}

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean;
  }
>(({ className, children, hideClose, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  /**
   * Focus restoration lives in `useOpenerFocusRestore` above — read the note there
   * before changing anything here.
   */
  const { captureOpener, restoreOpener } = useOpenerFocusRestore();

  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        captureOpener();
      }}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        restoreOpener(event);
      }}
      className={cn(
        'fixed left-1/2 top-1/2 z-[200] -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-lg max-h-[90vh] overflow-y-auto',
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-lg)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm text-[var(--text-muted)] opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--brand-bright)]">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

/**
 * The same dialog, anchored to the left edge and full height — the signed-in
 * navigation drawer below 768px (Layer H · H1).
 *
 * ⚠️ **A dialog rather than a hand-rolled panel, deliberately.** The approved design
 * asks for four things a disclosure panel does not give: focus stays inside while it
 * is open, Escape closes it and returns focus to the button, the rest of the document
 * is hidden from assistive technology, and the page behind does not scroll. Radix
 * already does all four and `DialogContent` has already had the one defect they hide
 * (5A-112) found and fixed in it. Writing a second focus trap a fortnight later is how
 * two controls end up behaving differently (11c) — so this shares everything except
 * the geometry.
 *
 * ⚠️ Its consumer uses a real `<DialogTrigger>`, which is the case the note above says
 * no dialog in this app had. That makes Radix's own `triggerRef` live, so focus
 * restoration has two mechanisms rather than one; `useOpenerFocusRestore` stays because
 * a trigger is the consumer's choice and the guarantee should not be.
 *
 * No built-in close button: the drawer's own header carries one beside the brand, where
 * the design puts it.
 */
export const DialogDrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const { captureOpener, restoreOpener } = useOpenerFocusRestore();

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          captureOpener();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          restoreOpener(event);
        }}
        className={cn(
          'fixed left-0 top-0 z-[200] flex h-full flex-col',
          // Never the whole screen: a strip of the page stays visible so the reader
          // can see what they are covering, and has somewhere obvious to tap to
          // dismiss. 56px is comfortably wider than a thumb.
          'w-[min(260px,calc(100vw-56px))]',
          'overflow-y-auto bg-[var(--bg-sidebar)] border-r border-[var(--border)] shadow-[var(--shadow-lg)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogDrawerContent.displayName = 'DialogDrawerContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1 p-5 border-b border-[var(--border)]', className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-3 p-5 border-t border-[var(--border)]', className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-[15px] font-bold text-[var(--text-primary)] tracking-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-[12px] text-[var(--text-muted)] leading-relaxed', className)}
      {...props}
    />
  );
}
