'use client';

import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from './modal';
import { Button } from './button';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  onConfirm,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${variant === 'destructive' ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
              <AlertTriangle className={`h-5 w-5 ${variant === 'destructive' ? 'text-red-400' : 'text-blue-400'}`} />
            </div>
            <ModalTitle>{title}</ModalTitle>
          </div>
          <ModalDescription className="pt-3">{message}</ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={async () => {
              await onConfirm();
              onOpenChange(false);
            }}
            disabled={loading}
            className={variant === 'destructive' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
