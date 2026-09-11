export type TaskMedia = {id?: string; url: string; caption: string; width?: number; height?: number;};
export function selectTaskReferenceImages(images: TaskMedia[], task: any): TaskMedia[];
