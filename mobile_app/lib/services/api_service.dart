import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'storage_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  late Dio _dio;
  static const String baseUrl = kDebugMode 
    ? 'http://localhost:3000/api' 
    : 'https://your-production-api.com/api';

  void init() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    // Add interceptors
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Add auth token if available
        final token = await StorageService.instance.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        
        if (kDebugMode) {
          print('REQUEST: ${options.method} ${options.path}');
          print('HEADERS: ${options.headers}');
          if (options.data != null) {
            print('DATA: ${options.data}');
          }
        }
        
        handler.next(options);
      },
      onResponse: (response, handler) {
        if (kDebugMode) {
          print('RESPONSE: ${response.statusCode} ${response.requestOptions.path}');
          print('DATA: ${response.data}');
        }
        handler.next(response);
      },
      onError: (error, handler) {
        if (kDebugMode) {
          print('ERROR: ${error.response?.statusCode} ${error.requestOptions.path}');
          print('MESSAGE: ${error.message}');
          print('DATA: ${error.response?.data}');
        }
        handler.next(error);
      },
    ));
  }

  // Auth endpoints
  Future<ApiResponse<Map<String, dynamic>>> login(String email, String password, {String? twoFactorCode}) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
        if (twoFactorCode != null) 'twoFactorCode': twoFactorCode,
      });
      
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    try {
      final response = await _dio.post('/auth/register', data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
        if (phone != null) 'phone': phone,
      });
      
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> setup2FA() async {
    try {
      final response = await _dio.post('/auth/setup-2fa');
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> verify2FA(String token) async {
    try {
      final response = await _dio.post('/auth/verify-2fa', data: {
        'token': token,
      });
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  // Wallet endpoints
  Future<ApiResponse<List<Map<String, dynamic>>>> getWallets() async {
    try {
      final response = await _dio.get('/wallets');
      return ApiResponse.success(List<Map<String, dynamic>>.from(response.data['data']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> createWallet(String walletName) async {
    try {
      final response = await _dio.post('/wallets', data: {
        'walletName': walletName,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> getWallet(String walletId) async {
    try {
      final response = await _dio.get('/wallets/$walletId');
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> updateWalletBalance(String walletId) async {
    try {
      final response = await _dio.post('/wallets/$walletId/balance');
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> sendUSDC({
    required String walletId,
    required String toAddress,
    required double amount,
    String? memo,
  }) async {
    try {
      final response = await _dio.post('/wallets/$walletId/send', data: {
        'toAddress': toAddress,
        'amount': amount,
        if (memo != null) 'memo': memo,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<List<Map<String, dynamic>>>> getTransactionHistory(
    String walletId, {
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final response = await _dio.get('/wallets/$walletId/transactions', queryParameters: {
        'limit': limit,
        'offset': offset,
      });
      return ApiResponse.success(List<Map<String, dynamic>>.from(response.data['data']['transactions']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> setPrimaryWallet(String walletId) async {
    try {
      final response = await _dio.post('/wallets/$walletId/set-primary');
      return ApiResponse.success(response.data);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> estimateGas({
    required String fromAddress,
    required String toAddress,
    required double amount,
  }) async {
    try {
      final response = await _dio.post('/wallets/estimate-gas', data: {
        'fromAddress': fromAddress,
        'toAddress': toAddress,
        'amount': amount,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  // Contact endpoints
  Future<ApiResponse<List<Map<String, dynamic>>>> getContacts() async {
    try {
      final response = await _dio.get('/contacts');
      return ApiResponse.success(List<Map<String, dynamic>>.from(response.data['data']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> addContact({
    required String name,
    required String address,
    String? notes,
  }) async {
    try {
      final response = await _dio.post('/contacts', data: {
        'name': name,
        'address': address,
        if (notes != null) 'notes': notes,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> updateContact({
    required String contactId,
    required String name,
    String? notes,
  }) async {
    try {
      final response = await _dio.put('/contacts/$contactId', data: {
        'name': name,
        if (notes != null) 'notes': notes,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<void>> deleteContact(String contactId) async {
    try {
      await _dio.delete('/contacts/$contactId');
      return ApiResponse.success(null);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<List<Map<String, dynamic>>>> searchContacts(String query) async {
    try {
      final response = await _dio.get('/contacts/search', queryParameters: {
        'q': query,
      });
      return ApiResponse.success(List<Map<String, dynamic>>.from(response.data['data']));
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  // Backup endpoints
  Future<ApiResponse<Map<String, dynamic>>> createBackup(String password) async {
    try {
      final response = await _dio.post('/backup/create', data: {
        'password': password,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> restoreBackup({
    required Map<String, dynamic> backup,
    required String password,
  }) async {
    try {
      final response = await _dio.post('/backup/restore', data: {
        'backup': backup,
        'password': password,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> importWallet({
    required String privateKey,
    required String walletName,
  }) async {
    try {
      final response = await _dio.post('/backup/import', data: {
        'privateKey': privateKey,
        'walletName': walletName,
      });
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  // Transaction endpoints
  Future<ApiResponse<Map<String, dynamic>>> getTransaction(String txHash) async {
    try {
      final response = await _dio.get('/transactions/$txHash');
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  Future<ApiResponse<Map<String, dynamic>>> getNetworkInfo() async {
    try {
      final response = await _dio.get('/transactions/network/info');
      return ApiResponse.success(response.data['data']);
    } on DioException catch (e) {
      return ApiResponse.error(_handleError(e));
    }
  }

  String _handleError(DioException error) {
    if (error.response?.data != null && error.response!.data['message'] != null) {
      return error.response!.data['message'];
    }
    
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Connection timeout. Please check your internet connection.';
      case DioExceptionType.badResponse:
        return 'Server error. Please try again later.';
      case DioExceptionType.cancel:
        return 'Request was cancelled.';
      case DioExceptionType.unknown:
        return 'Network error. Please check your connection.';
      default:
        return 'An unexpected error occurred.';
    }
  }
}

class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? error;

  ApiResponse.success(this.data) : success = true, error = null;
  ApiResponse.error(this.error) : success = false, data = null;
}
