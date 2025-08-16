class Wallet {
  final String id;
  final String walletName;
  final String address;
  final double balance;
  final bool isPrimary;
  final DateTime? lastBalanceUpdate;
  final DateTime createdAt;
  final String status;

  Wallet({
    required this.id,
    required this.walletName,
    required this.address,
    required this.balance,
    required this.isPrimary,
    this.lastBalanceUpdate,
    required this.createdAt,
    required this.status,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    return Wallet(
      id: json['id'],
      walletName: json['walletName'],
      address: json['address'],
      balance: double.tryParse(json['balance'].toString()) ?? 0.0,
      isPrimary: json['isPrimary'] ?? false,
      lastBalanceUpdate: json['lastBalanceUpdate'] != null 
        ? DateTime.parse(json['lastBalanceUpdate'])
        : null,
      createdAt: DateTime.parse(json['createdAt']),
      status: json['status'] ?? 'active',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'walletName': walletName,
      'address': address,
      'balance': balance.toString(),
      'isPrimary': isPrimary,
      'lastBalanceUpdate': lastBalanceUpdate?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      'status': status,
    };
  }

  Wallet copyWith({
    String? id,
    String? walletName,
    String? address,
    double? balance,
    bool? isPrimary,
    DateTime? lastBalanceUpdate,
    DateTime? createdAt,
    String? status,
  }) {
    return Wallet(
      id: id ?? this.id,
      walletName: walletName ?? this.walletName,
      address: address ?? this.address,
      balance: balance ?? this.balance,
      isPrimary: isPrimary ?? this.isPrimary,
      lastBalanceUpdate: lastBalanceUpdate ?? this.lastBalanceUpdate,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
    );
  }

  String get shortAddress => '${address.substring(0, 6)}...${address.substring(38)}';
  String get formattedBalance => balance.toStringAsFixed(2);
}
