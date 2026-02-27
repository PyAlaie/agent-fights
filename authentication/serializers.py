from rest_framework import serializers
from django.contrib.auth.models import User

class UserSignUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128)
    
    def validate(self, data):
        """
        Check if the username actually exists and also match the password.
        """
        qs = User.objects.filter(username=data['username'])
        if qs.exists():
            user = qs.first()
            if user.check_password(data['password']):
                data['user'] = user
                return data
            raise serializers.ValidationError(detail='password is wrong!')
        raise serializers.ValidationError(detail='username doesn\'t exist!')