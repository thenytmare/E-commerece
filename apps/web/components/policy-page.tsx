import { Container, Heading, Section, Text } from '@repo/ui';

/**
 * Shared shell for the static policy pages linked from the footer.
 *
 * NOTE FOR THE STORE OWNER: the copy on these pages is a sensible starting
 * point, not legal advice. Review the wording — especially return windows and
 * delivery timings — against how the business actually operates before
 * launch.
 */
export function PolicyPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main>
      <Section spacing="md" className="border-b border-border bg-card">
        <Container>
          <Heading as="h1" size="lg" className="mb-2">
            {title}
          </Heading>
          <Text variant="muted" className="max-w-2xl">
            {intro}
          </Text>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="max-w-2xl space-y-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
            {children}
          </div>
        </Container>
      </Section>
    </main>
  );
}
