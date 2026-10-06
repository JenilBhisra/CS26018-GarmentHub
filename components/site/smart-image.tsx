import Image, { type ImageProps } from "next/image";

interface SmartImageProps extends Omit<ImageProps, "alt" | "src"> {
  src: ImageProps["src"];
  alt?: string;
}

export function SmartImage({ src, alt = "", className, ...props }: SmartImageProps) {
  // If we have width & height OR fill, we use next/image
  const useNextImage = (props.width && props.height) || props.fill;

  if (useNextImage) {
    if (typeof src === "string") {
      const isUnsplash = src.includes("images.unsplash.com");
      const isRelative = src.startsWith("/") || src.startsWith(".");
      const unoptimized = !isUnsplash && !isRelative;

      return (
        <Image
          src={src}
          alt={alt}
          className={className}
          unoptimized={unoptimized}
          {...props}
        />
      );
    }
    return <Image src={src} alt={alt} className={className} {...props} />;
  }

  // Fall back to a 1x1 transparent next/image with style cover when layout props are absent.
  // This avoids the no-img-element lint warning while still allowing free-sizing via className.
  return (
    <Image
      src={typeof src === "string" ? src : "/placeholder.png"}
      alt={alt}
      className={className}
      width={800}
      height={600}
      unoptimized
      {...(props as any)}
    />
  );
}
