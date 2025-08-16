import 'package:flutter/foundation.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';
import '../services/biometric_service.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  User? _user;
  bool _isLoading = false;
  bool _isAuthenticated = false;
  String? _error;

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  String? get error => _error;

  final ApiService _apiService = ApiService();
  final StorageService _storageService = StorageService.instance;
  final BiometricService _biometricService = BiometricService.instance;

  AuthProvider() {
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    _setLoading(true);
    
    try {
      final token = await _storageService.getToken();
      final userData = await _storageService.getUserData();
      
      if (token != null && userData != null) {
        _user = User.fromJson(userData);
        _isAuthenticated = true;
      }
    } catch (e) {
      debugPrint('Error checking auth status: $e');
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> login(String email, String password, {String? twoFactorCode}) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _apiService.login(email, password, twoFactorCode: twoFactorCode);
      
      if (response.success && response.data != null) {
        final data = response.data!;
        
        // Check if 2FA is required
        if (data['requiresTwoFactor'] == true) {
          _setLoading(false);
          return false; // Indicates 2FA is needed
        }
        
        // Save token and user data
        await _storageService.saveToken(data['data']['token']);
        await _storageService.saveUserData(data['data']['user']);
        
        _user = User.fromJson(data['data']['user']);
        _isAuthenticated = true;
        
        _setLoading(false);
        return true;
      } else {
        _setError(response.error ?? 'Login failed');
        _setLoading(false);
        return false;
      }
    } catch (e) {
      _setError('An unexpected error occurred');
      _setLoading(false);
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    String? phone,
  }) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _apiService.register(
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
      );
      
      if (response.success && response.data != null) {
        final data = response.data!;
        
        // Save token and user data
        await _storageService.saveToken(data['data']['token']);
        await _storageService.saveUserData(data['data']['user']);
        
        _user = User.fromJson(data['data']['user']);
        _isAuthenticated = true;
        
        _setLoading(false);
        return true;
      } else {
        _setError(response.error ?? 'Registration failed');
        _setLoading(false);
        return false;
      }
    } catch (e) {
      _setError('An unexpected error occurred');
      _setLoading(false);
      return false;
    }
  }

  Future<bool> authenticateWithBiometrics() async {
    try {
      final isAvailable = await _biometricService.isAvailable();
      if (!isAvailable) {
        _setError('Biometric authentication is not available');
        return false;
      }

      final isAuthenticated = await _biometricService.authenticate(
        reason: 'Please authenticate to access your wallet',
      );

      if (isAuthenticated) {
        // Check if we have stored credentials
        final token = await _storageService.getToken();
        final userData = await _storageService.getUserData();
        
        if (token != null && userData != null) {
          _user = User.fromJson(userData);
          _isAuthenticated = true;
          notifyListeners();
          return true;
        }
      }

      return false;
    } catch (e) {
      _setError('Biometric authentication failed');
      return false;
    }
  }

  Future<Map<String, dynamic>?> setup2FA() async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _apiService.setup2FA();
      
      if (response.success && response.data != null) {
        _setLoading(false);
        return response.data!['data'];
      } else {
        _setError(response.error ?? '2FA setup failed');
        _setLoading(false);
        return null;
      }
    } catch (e) {
      _setError('An unexpected error occurred');
      _setLoading(false);
      return null;
    }
  }

  Future<bool> verify2FA(String token) async {
    _setLoading(true);
    _clearError();

    try {
      final response = await _apiService.verify2FA(token);
      
      if (response.success) {
        // Update user data to reflect 2FA is enabled
        if (_user != null) {
          _user = _user!.copyWith(twoFactorEnabled: true);
          await _storageService.saveUserData(_user!.toJson());
        }
        
        _setLoading(false);
        return true;
      } else {
        _setError(response.error ?? '2FA verification failed');
        _setLoading(false);
        return false;
      }
    } catch (e) {
      _setError('An unexpected error occurred');
      _setLoading(false);
      return false;
    }
  }

  Future<void> logout() async {
    _setLoading(true);
    
    try {
      await _storageService.clearAll();
      _user = null;
      _isAuthenticated = false;
      _clearError();
    } catch (e) {
      debugPrint('Error during logout: $e');
    } finally {
      _setLoading(false);
    }
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String error) {
    _error = error;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
    notifyListeners();
  }
}
