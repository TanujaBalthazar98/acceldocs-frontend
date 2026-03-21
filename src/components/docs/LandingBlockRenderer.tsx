import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LandingBlockType =
  | "hero"
  | "featured_sections"
  | "featured_pages"
  | "text"
  | "cta"
  | "links";

export interface LandingBlock {
  id: string;
  type: LandingBlockType;
  props: Record<string, any>;
}

interface BlockRendererProps {
  block: LandingBlock;
  primaryColor: string;
  onNavigate?: (href: string) => void;
}

export function LandingBlockRenderer({
  block,
  primaryColor,
  onNavigate,
}: BlockRendererProps) {
  switch (block.type) {
    case "text":
      return <TextBlock content={block.props.content} />;

    case "cta":
      return (
        <CtaBlock
          title={block.props.title}
          description={block.props.description}
          buttonText={block.props.button_text}
          buttonUrl={block.props.button_url}
          primaryColor={primaryColor}
          onNavigate={onNavigate}
        />
      );

    case "links":
      return (
        <LinksBlock
          title={block.props.title}
          items={block.props.items || []}
          primaryColor={primaryColor}
          onNavigate={onNavigate}
        />
      );

    case "featured_sections":
    case "featured_pages":
      return (
        <FeaturedCardsBlock
          title={block.props.title}
          items={block.props.items || []}
          columns={block.props.columns || 3}
          primaryColor={primaryColor}
          onNavigate={onNavigate}
        />
      );

    default:
      return null;
  }
}

function TextBlock({ content }: { content?: string }) {
  if (!content) return null;
  return (
    <section className="px-4 py-8">
      <div className="max-w-3xl mx-auto prose prose-sm prose-neutral dark:prose-invert">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </section>
  );
}

function CtaBlock({
  title,
  description,
  buttonText,
  buttonUrl,
  primaryColor,
  onNavigate,
}: {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  primaryColor: string;
  onNavigate?: (href: string) => void;
}) {
  if (!title) return null;
  return (
    <section className="px-4 py-10">
      <div
        className="max-w-3xl mx-auto rounded-xl p-8 text-center"
        style={{ backgroundColor: `${primaryColor}08`, borderColor: `${primaryColor}20`, border: "1px solid" }}
      >
        <h2 className="text-xl font-semibold text-foreground brand-heading">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 brand-body">{description}</p>
        )}
        {buttonText && buttonUrl && (
          <Button
            className="mt-4 gap-2"
            style={{ backgroundColor: primaryColor }}
            onClick={() => onNavigate?.(buttonUrl)}
          >
            {buttonText}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </section>
  );
}

function LinksBlock({
  title,
  items,
  primaryColor,
  onNavigate,
}: {
  title?: string;
  items: Array<{ label: string; url: string; description?: string }>;
  primaryColor: string;
  onNavigate?: (href: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {title && (
          <h2 className="text-lg font-semibold text-foreground mb-4 brand-heading">{title}</h2>
        )}
        <div className="space-y-2">
          {items.map((item, i) => (
            <button
              key={`${item.label}-${i}`}
              onClick={() => onNavigate?.(item.url)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
            >
              <ExternalLink className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCardsBlock({
  title,
  items,
  columns,
  primaryColor,
  onNavigate,
}: {
  title?: string;
  items: Array<{ title: string; description?: string; href?: string }>;
  columns: 2 | 3;
  primaryColor: string;
  onNavigate?: (href: string) => void;
}) {
  if (!items.length) return null;
  const gridClass = columns === 2
    ? "grid-cols-1 md:grid-cols-2"
    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {title && (
          <h2 className="text-lg font-semibold text-foreground mb-4 text-center brand-heading">
            {title}
          </h2>
        )}
        <div className={`grid ${gridClass} gap-4`}>
          {items.map((item, i) => (
            <button
              key={`${item.title}-${i}`}
              onClick={() => item.href && onNavigate?.(item.href)}
              className="group p-5 rounded-xl border border-border bg-card hover:shadow-md transition-all text-left"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "";
              }}
            >
              <h3 className="text-sm font-semibold text-foreground brand-heading">{item.title}</h3>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-1 brand-body">{item.description}</p>
              )}
              {item.href && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium mt-3"
                  style={{ color: primaryColor }}
                >
                  Learn more <ArrowRight className="h-3 w-3" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
