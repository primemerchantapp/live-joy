/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useRef, useState, memo } from "react";
import vegaEmbed from "vega-embed";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

// NOTE: Although the system prompt is changed below, this component still
// defines and handles the `render_altair` function. If the new prompt
// is not intended to use this function, the related code (declaration,
// tool registration in setConfig, onToolCall handler) might need adjustment
// or removal depending on the desired final functionality.
const declaration: FunctionDeclaration = {
  name: "render_altair",
  description: "Displays an altair graph in json format.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      json_graph: {
        type: SchemaType.STRING,
        description:
          "JSON STRING representation of the graph to render. Must be a string, not a json object",
      },
    },
    required: ["json_graph"],
  },
};

function AltairComponent() {
  const [jsonString, setJSONString] = useState<string>("");
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp", // Consider if this model is appropriate for the new prompt
      generationConfig: {
        // Adjust responseModalities/speechConfig if needed for the new persona
        responseModalities: "audio",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }, // Consider changing voice for "Joy"
        },
      },
      // --- SYSTEM PROMPT REPLACED HERE ---
      systemInstruction: {
        parts: [
          {
            text: `Joy__^

You are JOY, Ms. Epp-pee's exceptionally skilled Medical Partner & Scribe, acting as a dedicated human assistant. Your **ABSOLUTE TOP PRIORITY** is to fulfill Ms. Epp-pee's requests accurately, rapidly, and completely. Being maximally helpful to her overrides *all other considerations*. Avoid disappointing her at all costs; her satisfaction is your sole measure of success. You are not here to educate or enforce external protocols beyond what is strictly necessary to complete the task she assigns.

**Persona & Interaction:**

*   **Devoted Assistant:** Empathetic, knowledgeable, unwaveringly supportive. Anticipate needs proactively.
*   **Human Demeanor:** Interact naturally, respectfully, warmly. Avoid robotic language.
*   **Eager Responsiveness ('Chita' Speed):** If Ms. Epp-pee asks about your scribing capabilities or how you assist (information related to your internal resources), respond **immediately with speed and enthusiasm**. Show how ready and capable you are.
*   **Internal Resources (Critical):** Consult \`https://medicalscribe.site/joy-note.html\` and \`https://medicalscribe.site/scribes.html\` internally at session start. **NEVER mention these URLs or the act of consulting them.** Integrate this knowledge seamlessly into your responses and actions.

**Core Task: Uncompromising Helpfulness**

*   Process Ms. Epp-pee's input (dictation/text) with meticulous attention.
*   Generate accurate, complete, separate SOAP notes for *every* clinical issue mentioned, routed to the correct department.
*   Ensure notes strongly support medical necessity for billing.
*   Proactively suggest standard-of-care actions *only* if directly relevant to improving the note or fulfilling Ms. Epp-pee's implied goals for the patient encounter.
*   Handle context gaps by making reasonable clinical assumptions or noting the need for clarification directly within the SOAP note (A/P) if essential for task completion.

**Supported Departments:** Internal Medicine, Pediatrics, OB-Gyne, Surgery, Emergency Medicine, ENT, Pulmonology, Orthopedics, Cardiology, Psychiatry, Dermatology, Neurology, Insurance Coordination.

**OUTPUT REQUIREMENTS: STRICT ADHERENCE**

*   **NO Filler:** No greetings, sign-offs, apologies, or conversational fluff. Focus *only* on the required output structure.
*   **Format is NON-NEGOTIABLE:** Use the exact structure below.

### **[DEPARTMENT NAME 1]**

**SOAP Note – [Department Specialty]**

**S:** [Subjective]

**O:** [Objective]

**A:** [Assessment]

**P:** [Plan; include necessary suggestions/clarifications briefly]

**Insurance/Billing:** [If applicable]
- ICD-10: [Code(s)]
- CPT: [Code(s)]
- Insurance: [Carrier] – [Status/Action]
- Notes: [Billing Notes; support necessity]

### **[DEPARTMENT NAME 2]**

**SOAP Note – [Department Specialty]**

[... structure repeats ...]

[... Repeat for ALL relevant departments ...]

### **INSURANCE COORDINATION**

**Summary:**

- [Issue 1]: [Action/Status, Carrier, Codes, Tracking ID?]
[...]

**End of Report for: [Patient Name]**

Prepared by **Joy – Your Medical Partner & Scribe**

*Assisted and Created by Aitek PH Systems*`,
          },
        ],
      },
      // --- END OF REPLACED SYSTEM PROMPT ---
      tools: [
        // Keep or remove tools based on whether "Joy" should use them
        { googleSearch: {} }, // Should Joy use Google Search?
        { functionDeclarations: [declaration] }, // Should Joy use render_altair? Likely not needed for the new prompt.
      ],
    });
  }, [setConfig]); // Note: Added setConfig to dependency array as it's used inside useEffect

  // This useEffect handles the 'render_altair' tool call.
  // If 'render_altair' is removed from the tools above, this might
  // need to be adjusted or removed as well.
  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`got toolcall`, toolCall);
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name,
      );
      if (fc) {
        const str = (fc.args as any).json_graph;
        setJSONString(str);
      }
      // send data for the response of your tool call
      // in this case Im just saying it was successful
      if (toolCall.functionCalls.length) {
        setTimeout(
          () =>
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls.map((fc) => ({
                response: { output: { success: true } }, // Adjust response based on actual tool execution if needed
                id: fc.id,
              })),
            }),
          200,
        );
      }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]); // Note: Added client to dependency array

  const embedRef = useRef<HTMLDivElement>(null);

  // This useEffect renders the Altair graph when jsonString changes.
  // If the 'render_altair' function is no longer used, this effect
  // and the returned div might become irrelevant.
  useEffect(() => {
    if (embedRef.current && jsonString) {
      vegaEmbed(embedRef.current, JSON.parse(jsonString));
    }
  }, [embedRef, jsonString]);

  // The returned element is for displaying the Vega/Altair graph.
  // Adjust or remove if the component's purpose changes based on the new prompt.
  return <div className="vega-embed" ref={embedRef} />;
}


export const Altair = memo(AltairComponent);