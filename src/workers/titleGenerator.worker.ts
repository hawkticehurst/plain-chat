/**
 * Web Worker for generating chat titles in parallel with AI responses
 * This allows title generation to happen concurrently with the streaming response
 */

interface TitleGenerationRequest {
  chatId: string;
  firstMessage: string;
  apiBaseUrl: string;
  authToken: string;
}

interface TitleGenerationResponse {
  success: boolean;
  chatId: string;
  title?: string;
  error?: string;
}

// Listen for messages from the main thread
self.addEventListener(
  "message",
  async (event: MessageEvent<TitleGenerationRequest>) => {
    console.log("🔧 Worker: Received message from main thread:", event.data);
    
    const { chatId, firstMessage, apiBaseUrl, authToken } = event.data;

    try {
      const url = `${apiBaseUrl}/chats/${chatId}/generate-title`;
      console.log(`🌐 Worker: Making request to ${url}`);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          firstMessage,
        }),
      });

      console.log(`📡 Worker: Response status for chat ${chatId}:`, response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(`📄 Worker: Response data for chat ${chatId}:`, data);
        
        const result: TitleGenerationResponse = {
          success: data.success,
          chatId,
          title: data.success ? data.title : undefined,
          error: data.success ? undefined : "Title generation failed",
        };

        console.log(`✅ Worker: Sending result for chat ${chatId}:`, result);
        self.postMessage(result);
      } else {
        const errorText = await response.text();
        console.error(
          `❌ Worker: Title generation failed for chat ${chatId}:`,
          response.status,
          errorText
        );

        self.postMessage({
          success: false,
          chatId,
          error: `HTTP ${response.status}: ${errorText}`,
        } as TitleGenerationResponse);
      }
    } catch (error) {
      console.error(
        `❌ Worker: Network error generating title for chat ${chatId}:`,
        error
      );

      self.postMessage({
        success: false,
        chatId,
        error: error instanceof Error ? error.message : "Unknown error",
      } as TitleGenerationResponse);
    }
  }
);

// Export types for use in main thread
export type { TitleGenerationRequest, TitleGenerationResponse };
