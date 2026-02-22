export const COLOR_NAMES: Record<number, string> = {
  0: 'red',
  1: 'green',
  2: 'yellow',
  3: 'purple',
  4: 'orange',
};

export const CONSTRAINTS: Record<string, string> = {
  new_build:
    'This is a new build project. Focus on cohesive design, material consistency, and professional construction appearance. ',
  new_build_masked:
    'Style Constraint (New Build): Apply the material as a realistic, brand-new exterior finish within the masked region. Follow the existing surface contours and perspective. Ensure the new material does not bleed beyond the red boundary, preserving the surrounding environment, lighting, and sky exactly as they appear in the input. ',
  existing:
    'Style Constraint (Existing Photo): The base image is a real photograph. Perform a photorealistic, localized material substitution. Preserve the existing camera angle, lighting, landscaping, and architectural geometry outside the mask. Seamlessly integrate the new material into the target area without extending beyond the red boundary. ',
  architectural_drawing:
    'This is an architectural drawing. Interpret accurately. Apply materials to match design intent. Maintain scale and proportions. ',
  architectural_drawing_masked:
    'Style Constraint (Architectural Drawing): The base image is a drawing. Convert only the red masked region to the specified material while maintaining standard architectural drawing conventions. Preserve all structural linework, white space, and geometry outside the mask exactly as in the input. ',
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
