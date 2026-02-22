export const COLOR_NAMES: Record<number, string> = {
  0: 'red',
  1: 'green',
  2: 'yellow',
  3: 'purple',
  4: 'orange',
};

/** When masking is used: user uploads reference, masks area, prompts "apply the stucco from sample 1 to masked area". */
export const MASKED_EDIT_INSTRUCTION =
  'You receive: (1) a base image with red overlay marking the edit area, (2) a reference image, (3) a user prompt. ' +
  'Task: Look at the reference image and identify the material the user names (e.g. stucco, brick, siding). ' +
  'Apply that material ONLY to the red overlay area. Do not modify any pixel outside the red area. ' +
  'Preserve the rest of the image exactly as in the input. Do not extend, blend, or bleed material beyond the red boundary. ';

export const CONSTRAINTS: Record<string, string> = {
  new_build:
    'This is a new build project. Focus on cohesive design, material consistency, and professional construction appearance. ',
  new_build_masked:
    MASKED_EDIT_INSTRUCTION +
    'Follow existing geometry and surface contours. Apply the material as a realistic exterior finish within the masked region only. Preserve unmasked areas including lighting, sky, and environment. ',
  existing:
    'The base image is a real photograph. Perform a localized material substitution only where requested. Preserve camera angle, lighting, and all unmasked regions exactly. ' +
    MASKED_EDIT_INSTRUCTION +
    'Preserve lighting, landscaping, and architectural geometry outside the mask. ',
  architectural_drawing:
    'This is an architectural drawing. Interpret accurately. Apply materials to match design intent. Maintain scale and proportions. ',
  architectural_drawing_masked:
    MASKED_EDIT_INSTRUCTION +
    'Preserve all linework and structure outside the mask. Convert only the masked region to the specified material. Maintain drawing conventions. ',
};

export function buildPrompt(
  userPrompt: string,
  projectType: string | null,
  hasMask: boolean
): string {
  let constraint: string | undefined;
  if (projectType === 'new_build' && hasMask) {
    constraint = CONSTRAINTS['new_build_masked'];
  } else if (projectType === 'architectural_drawing' && hasMask) {
    constraint = CONSTRAINTS['architectural_drawing_masked'];
  } else if (projectType && CONSTRAINTS[projectType]) {
    constraint = CONSTRAINTS[projectType];
  }
  const instruction = userPrompt.trim();
  if (constraint) {
    return `${constraint}User instruction: ${instruction}`;
  }
  return instruction;
}
