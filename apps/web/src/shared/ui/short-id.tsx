import { Button, HStack, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router';

import { shortId } from '@/shared/format';

import { toaster } from './toaster';

const copy = (id: string) => {
  navigator.clipboard.writeText(id).then(
    () => {
      toaster.success({ description: id, title: 'Copied' });
    },
    () => {
      toaster.error({ description: id, title: 'Could not copy' });
    },
  );
};

/**
 * An ID shown as its first 8 characters. Clicking the ID copies the full value; with `to` the ID
 * is a link instead and a small button next to it copies.
 */
export const ShortId = ({ id, to }: { id: string; to?: string }) =>
  to === undefined ? (
    <Button
      fontFamily="mono"
      fontSize="xs"
      fontWeight="normal"
      h="auto"
      minW="0"
      onClick={(event) => {
        event.stopPropagation();
        copy(id);
      }}
      px="1"
      py="0.5"
      title={`${id} · click to copy`}
      variant="ghost"
    >
      {shortId(id)}
    </Button>
  ) : (
    <HStack display="inline-flex" gap="1.5">
      <Link asChild color="blue.600" fontFamily="mono" fontSize="xs" title={id}>
        <RouterLink to={to}>{shortId(id)}</RouterLink>
      </Link>
      <Button
        aria-label={`Copy ${id}`}
        color="fg.muted"
        fontSize="xs"
        fontWeight="normal"
        h="auto"
        minW="0"
        onClick={(event) => {
          event.stopPropagation();
          copy(id);
        }}
        px="1"
        py="0.5"
        variant="ghost"
      >
        copy
      </Button>
    </HStack>
  );
