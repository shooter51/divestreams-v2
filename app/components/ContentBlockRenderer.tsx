/**
 * Content Block Renderer
 *
 * Renders different types of content blocks from the page builder.
 * Each block type has its own rendering logic and styling.
 */

import type {
  ContentBlock,
  HeadingBlock,
  ParagraphBlock,
  HtmlBlock,
  ImageBlock,
  GalleryBlock,
  TeamSectionBlock,
  ValuesGridBlock,
  CtaBlock,
  DividerBlock,
  SpacerBlock,
} from "../../lib/db/schema/page-content";

interface ContentBlockRendererProps {
  blocks: ContentBlock[];
  className?: string;
}

export function ContentBlockRenderer({
  blocks,
  className = "",
}: ContentBlockRendererProps) {
  return (
    <div className={className}>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "heading":
      return <HeadingRenderer block={block} />;
    case "paragraph":
      return <ParagraphRenderer block={block} />;
    case "html":
      return <HtmlRenderer block={block} />;
    case "image":
      return <ImageRenderer block={block} />;
    case "gallery":
      return <GalleryRenderer block={block} />;
    case "team-section":
      return <TeamSectionRenderer block={block} />;
    case "values-grid":
      return <ValuesGridRenderer block={block} />;
    case "cta":
      return <CtaRenderer block={block} />;
    case "divider":
      return <DividerRenderer block={block} />;
    case "spacer":
      return <SpacerRenderer block={block} />;
    default:
      return null;
  }
}

function HeadingRenderer({ block }: { block: HeadingBlock }) {
  const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
  const sizeClasses = {
    1: "text-4xl md:text-5xl",
    2: "text-3xl md:text-4xl",
    3: "text-2xl md:text-3xl",
    4: "text-xl md:text-2xl",
    5: "text-lg md:text-xl",
    6: "text-base md:text-lg",
  };

  return (
    <Tag className={`font-bold mb-6 ${sizeClasses[block.level]}`}>
      {block.content}
    </Tag>
  );
}

function ParagraphRenderer({ block }: { block: ParagraphBlock }) {
  return (
    <div
      className="prose prose-lg max-w-none mb-6"
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
}

function HtmlRenderer({ block }: { block: HtmlBlock }) {
  return (
    <div
      className="mb-6"
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
}

function ImageRenderer({ block }: { block: ImageBlock }) {
  return (
    <figure className="mb-8">
      <img
        src={block.url}
        alt={block.alt}
        width={block.width}
        height={block.height}
        className="rounded-xl w-full h-auto"
      />
      {block.caption && (
        <figcaption className="mt-2 text-sm text-center opacity-75">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

function GalleryRenderer({ block }: { block: GalleryBlock }) {
  const columns = block.columns || 3;
  const gridClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={`grid ${gridClasses[columns]} gap-4 mb-8`}>
      {block.images.map((image, index) => (
        <figure key={index} className="group">
          <img
            src={image.url}
            alt={image.alt}
            className="rounded-lg w-full h-auto object-cover aspect-square group-hover:opacity-90 transition-opacity"
          />
          {image.caption && (
            <figcaption className="mt-2 text-sm text-center opacity-75">
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function TeamSectionRenderer({ block }: { block: TeamSectionBlock }) {
  return (
    <section className="mb-16">
      {block.title && (
        <h2 className="text-3xl font-bold text-center mb-4">{block.title}</h2>
      )}
      {block.description && (
        <p className="text-lg opacity-75 text-center max-w-2xl mx-auto mb-12">
          {block.description}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {block.members.map((member) => (
          <div
            key={member.id}
            className="rounded-xl p-6 transition-shadow hover:shadow-lg"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            <div className="flex justify-center mb-4">
              {member.image ? (
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)" }}
                >
                  {member.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              )}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">{member.name}</h3>
              <p
                className="text-sm font-medium mt-1"
                style={{ color: "var(--primary-color)" }}
              >
                {member.role}
              </p>
              {member.bio && (
                <p className="mt-3 text-sm opacity-75">{member.bio}</p>
              )}
              {member.certifications && member.certifications.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {member.certifications.map((cert, i) => (
                    <span
                      key={i}
                      className="inline-block px-2 py-1 text-xs rounded-full"
                      style={{
                        backgroundColor: "var(--background-color)",
                        color: "var(--primary-color)",
                      }}
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValuesGridRenderer({ block }: { block: ValuesGridBlock }) {
  const columns = block.columns || 2;
  const gridClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <section className="mb-16">
      {block.title && (
        <h2 className="text-2xl font-bold mb-6">{block.title}</h2>
      )}
      <div className={`grid ${gridClasses[columns]} gap-6`}>
        {block.values.map((value) => (
          <div
            key={value.id}
            className="p-6 rounded-xl"
            style={{ backgroundColor: "var(--accent-color)" }}
          >
            {value.icon && (
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-2xl"
                style={{ backgroundColor: "var(--primary-color)" }}
              >
                {value.icon}
              </div>
            )}
            <h3 className="font-semibold text-lg">{value.title}</h3>
            <p className="mt-2 text-sm opacity-75">{value.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaRenderer({ block }: { block: CtaBlock }) {
  return (
    <section
      className="py-12 px-6 rounded-xl text-center mb-8"
      style={{
        backgroundColor: block.backgroundColor || "var(--primary-color)",
      }}
    >
      <h2 className="text-3xl font-bold text-white mb-4">{block.title}</h2>
      {block.description && (
        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          {block.description}
        </p>
      )}
      <a
        href={block.buttonUrl}
        className="inline-block bg-white px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
        style={{ color: "var(--primary-color)" }}
      >
        {block.buttonText}
      </a>
    </section>
  );
}

function DividerRenderer({ block }: { block: DividerBlock }) {
  const styleClasses = {
    solid: "border-solid",
    dashed: "border-dashed",
    dotted: "border-dotted",
  };

  return (
    <hr
      className={`my-8 border-t ${styleClasses[block.style || "solid"]}`}
      style={{ borderColor: "var(--accent-color)" }}
    />
  );
}

function SpacerRenderer({ block }: { block: SpacerBlock }) {
  return <div style={{ height: `${block.height}px` }} />;
}
