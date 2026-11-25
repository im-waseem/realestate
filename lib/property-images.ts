export function propertyImages(value: string): string[] {
  try {
    const images: unknown = JSON.parse(value);
    if (!Array.isArray(images)) return [];
    return images.filter((image): image is string => typeof image === "string" && (/^https:\/\//.test(image) || /^\/media\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(image) || /^\/images\/(interior|architecture)\.jpg$/.test(image))).slice(0, 12);
  } catch {
    return [];
  }
}
