import { Portal, Stack, Toast, Toaster as ChakraToaster, createToaster } from '@chakra-ui/react';

export const toaster = createToaster({ pauseOnPageIdle: true, placement: 'bottom-end' });

export const Toaster = () => (
  <Portal>
    <ChakraToaster toaster={toaster}>
      {(toast) => (
        <Toast.Root width="sm">
          <Toast.Indicator />
          <Stack flex="1" gap="1">
            {toast.title !== undefined && <Toast.Title>{toast.title}</Toast.Title>}
            {toast.description !== undefined && (
              <Toast.Description>{toast.description}</Toast.Description>
            )}
          </Stack>
          <Toast.CloseTrigger />
        </Toast.Root>
      )}
    </ChakraToaster>
  </Portal>
);
