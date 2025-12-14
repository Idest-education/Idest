"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Server,
  Clock,
  AlertCircle
} from "lucide-react";

interface ServiceStatus {
  name: string;
  endpoint: string;
  status: "loading" | "success" | "error" | "idle";
  responseTime?: number;
  error?: string;
  response?: unknown;
  timestamp?: string;
}

interface LogEntry {
  timestamp: string;
  service: string;
  status: "success" | "error";
  message: string;
  details?: unknown;
}

export default function ServiceStatusPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Auth Session (Local)", endpoint: "/api/session", status: "idle" },
    { name: "Classes API", endpoint: "/class", status: "idle" },
    { name: "Sessions - Upcoming", endpoint: "/session/upcoming", status: "idle" },
    { name: "Conversations API", endpoint: "/conversation", status: "idle" },
    { name: "User Profile", endpoint: "/user", status: "idle" },
  ]);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [backendUrl, setBackendUrl] = useState<string>("");
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [checkingServer, setCheckingServer] = useState(false);

  useEffect(() => {
    setBackendUrl(process.env.NEXT_PUBLIC_API_URL || "Chưa được cấu hình");
  }, []);

  const safeStringify = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const checkServerConnectivity = async () => {
    setCheckingServer(true);
        addLog("System", "success", "Đang kiểm tra kết nối máy chủ backend...");
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
        method: "GET",
      }).catch(() => {
        // If health endpoint doesn't exist, try a simple HEAD request
        return fetch(process.env.NEXT_PUBLIC_API_URL || "", {
          method: "HEAD",
        });
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok || response.status === 404) {
        // 404 means server is responding, just endpoint doesn't exist
        setServerOnline(true);
        addLog(
          "Server Connectivity",
          "success",
          `✓ Backend server is online (${responseTime}ms)`,
          { status: response.status, url: process.env.NEXT_PUBLIC_API_URL }
        );
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
      setServerOnline(false);
      addLog(
        "Server Connectivity",
        "error",
        `✗ Cannot reach backend server: ${errorMessage}`,
        { error: errorMessage, url: process.env.NEXT_PUBLIC_API_URL }
      );
    } finally {
      setCheckingServer(false);
    }
  };

  const addLog = (service: string, status: "success" | "error", message: string, details?: unknown) => {
    const log: LogEntry = {
      timestamp: new Date().toISOString(),
      service,
      status,
      message,
      details,
    };
    setLogs((prev) => [log, ...prev]);
  };

  const testService = async (index: number) => {
    const service = services[index];
    const startTime = Date.now();

    setServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status: "loading" } : s))
    );

    try {
      let response;
      const timestamp = new Date().toISOString();

      // Special handling for auth session (local API)
      if (service.endpoint === "/api/session") {
        response = await fetch(service.endpoint);
      } else {
        // External API calls
        const supabase = (await import("@/lib/supabase/client")).createClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          throw new Error("Không tìm thấy mã xác thực");
        }

        response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}${service.endpoint}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      if (response.ok) {
        setServices((prev) =>
          prev.map((s, i) =>
            i === index
              ? {
                  ...s,
                  status: "success",
                  responseTime,
                  response: data,
                  timestamp,
                }
              : s
          )
        );
        addLog(
          service.name,
          "success",
          `✓ Response received in ${responseTime}ms`,
          { status: response.status, data }
        );
      } else {
        throw new Error(`HTTP ${response.status}: ${data.message || "Yêu cầu thất bại"}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
      setServices((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                status: "error",
                responseTime,
                error: errorMessage,
                timestamp: new Date().toISOString(),
              }
            : s
        )
      );
      addLog(
        service.name,
        "error",
        `✗ Failed after ${responseTime}ms: ${errorMessage}`,
        error
      );
    }
  };

  const testAllServices = async () => {
    setIsTestingAll(true);
    setLogs([]);
        addLog("System", "success", "Bắt đầu kiểm tra sức khỏe dịch vụ toàn diện...");

    // First check server connectivity
    await checkServerConnectivity();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Then test all services
    for (let i = 0; i < services.length; i++) {
      await testService(i);
      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsTestingAll(false);
    addLog("System", "success", "Kiểm tra sức khỏe hoàn tất");
  };

  const resetAll = () => {
    setServices((prev) =>
      prev.map((s) => ({ ...s, status: "idle", error: undefined, response: undefined }))
    );
    setLogs([]);
    setServerOnline(null);
  };

  const getStatusIcon = (status: ServiceStatus["status"]) => {
    switch (status) {
      case "loading":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const successCount = services.filter((s) => s.status === "success").length;
  const errorCount = services.filter((s) => s.status === "error").length;
  const totalCount = services.length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="border-b border-gray-200 pb-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              Trạng thái dịch vụ
            </h1>
            <p className="text-gray-600">
              Theo dõi kết nối API và tình trạng dịch vụ
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={resetAll}
              variant="outline"
              disabled={isTestingAll}
            >
              Đặt lại
            </Button>
            <Button
              onClick={testAllServices}
              disabled={isTestingAll}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              {isTestingAll ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Đang kiểm tra...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Kiểm tra tất cả dịch vụ
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Backend URL Info & Server Status */}
      <Card className="p-4 mb-6 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">URL API Backend</p>
              <p className="text-sm text-gray-600 font-mono">{backendUrl}</p>
              {serverOnline !== null && (
                <div className="flex items-center gap-2 mt-1">
                  {serverOnline ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-700">Máy chủ trực tuyến</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-700">Máy chủ ngoại tuyến</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={checkServerConnectivity}
            disabled={checkingServer}
            variant="outline"
            size="sm"
          >
            {checkingServer ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang kiểm tra...
              </>
            ) : (
              "Kiểm tra kết nối"
            )}
          </Button>
        </div>
      </Card>

      {/* Status Summary */}
      {(successCount > 0 || errorCount > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-gray-600 mb-1">Tổng số dịch vụ</p>
            <p className="text-2xl font-semibold text-gray-900">{totalCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600 mb-1">Hoạt động tốt</p>
            <p className="text-2xl font-semibold text-green-600">
              {successCount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600 mb-1">Thất bại</p>
            <p className="text-2xl font-semibold text-red-600">{errorCount}</p>
          </Card>
        </div>
      )}

      {/* Services List */}
      <div className="space-y-4 mb-8">
        <h2 className="text-xl font-semibold text-gray-900">Dịch vụ</h2>
        {services.map((service, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                {getStatusIcon(service.status)}
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-600 font-mono">
                    {service.endpoint}
                  </p>
                  {service.error && (
                    <p className="text-sm text-red-600 mt-1">
                      Lỗi: {service.error}
                    </p>
                  )}
                  {service.responseTime !== undefined && (
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <p className="text-xs text-gray-600">
                        {service.responseTime}ms
                      </p>
                      {service.timestamp && (
                        <p className="text-xs text-gray-500">
                          • {new Date(service.timestamp).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Button
                onClick={() => testService(index)}
                disabled={service.status === "loading" || isTestingAll}
                variant="outline"
                size="sm"
              >
                {service.status === "loading" ? "Đang kiểm tra..." : "Kiểm tra"}
              </Button>
            </div>

            {/* Response Preview */}
            {service.response !== undefined && (
              <details className="mt-3">
                <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                  Xem phản hồi
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded-md text-xs overflow-x-auto">
                  {safeStringify(service.response)}
                </pre>
              </details>
            )}
          </Card>
        ))}
      </div>

      {/* Logs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Nhật ký</h2>
          {logs.length > 0 && (
            <Button
              onClick={() => setLogs([])}
              variant="outline"
              size="sm"
            >
              Xóa nhật ký
            </Button>
          )}
        </div>

        {logs.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">
              Chưa có nhật ký. Nhấp &ldquo;Kiểm tra tất cả dịch vụ&rdquo; để bắt đầu.
            </p>
          </Card>
        ) : (
          <Card className="p-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-md text-sm ${
                    log.status === "success"
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {log.service}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p
                        className={
                          log.status === "success"
                            ? "text-green-800"
                            : "text-red-800"
                        }
                      >
                        {log.message}
                      </p>
                    </div>
                  </div>
                  {log.details !== undefined && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-600 cursor-pointer">
                        Chi tiết
                      </summary>
                      <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                        {safeStringify(log.details)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

